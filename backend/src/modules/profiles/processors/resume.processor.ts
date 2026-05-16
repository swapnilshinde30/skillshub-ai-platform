import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { AiService } from '../../ai/ai.service';
import { EmbeddingService } from '../../ai/embedding.service';
import { ProfileBuilderService } from '../services/profile-builder.service';

export const RESUME_QUEUE   = 'resume-processing';
export const RESUME_JOB     = 'process-resume';

export interface ResumeJobData {
  uploadId: string;
  userId: string;
  rawText: string;
}

/**
 * BullMQ worker that runs the full ingestion pipeline in the background.
 *
 * Phases:
 *   10% — started
 *   40% — Claude extraction complete
 *   60% — Claude inference complete
 *   80% — profile saved to database
 *  100% — embeddings generated
 *
 * BullMQ retries the job automatically on failure (configured in ProfilesModule).
 * The processor is idempotent: re-running with the same uploadId replaces
 * the previous result.
 */
@Processor(RESUME_QUEUE)
export class ResumeProcessor extends WorkerHost {
  private readonly logger = new Logger(ResumeProcessor.name);

  constructor(
    private readonly aiService: AiService,
    private readonly embeddingService: EmbeddingService,
    private readonly profileBuilder: ProfileBuilderService,
  ) {
    super();
  }

  async process(job: Job<ResumeJobData>): Promise<void> {
    const { uploadId, userId, rawText } = job.data;
    const start = Date.now();

    this.logger.log(`[${uploadId}] Starting pipeline for user ${userId}`);

    try {
      // ── Phase 1: Extract structured data with Claude ───────────────────
      await job.updateProgress(10);
      this.logger.log(`[${uploadId}] Running Claude extraction...`);

      const { extraction, parseAttempts: ep } =
        await this.aiService.extractProfile(rawText);

      this.logger.log(
        `[${uploadId}] Extraction complete (${ep} attempt(s), confidence=${extraction.extractionConfidence.toFixed(2)}, ` +
        `${extraction.skills.length} skills, ${extraction.projects.length} projects)`,
      );
      await job.updateProgress(40);

      // ── Phase 2: Infer additional skills ──────────────────────────────
      this.logger.log(`[${uploadId}] Running Claude skill inference...`);
      const { skills: inferred, parseAttempts: ip } =
        await this.aiService.inferSkills(extraction);

      this.logger.log(
        `[${uploadId}] Inference complete (${ip} attempt(s), ${inferred.length} inferred skills)`,
      );
      await job.updateProgress(60);

      // ── Phase 3: Persist to database ──────────────────────────────────
      this.logger.log(`[${uploadId}] Saving profile to database...`);
      const profileId = await this.profileBuilder.saveExtractedProfile(
        userId,
        uploadId,
        extraction,
        inferred,
      );
      await job.updateProgress(80);

      // ── Phase 4: Generate embeddings ──────────────────────────────────
      this.logger.log(`[${uploadId}] Generating embeddings...`);
      await Promise.all([
        this.embeddingService.generateAndSaveProfileEmbedding(profileId),
        this.embeddingService.generateAndSaveSkillEmbeddings(profileId),
      ]);
      await job.updateProgress(100);

      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      this.logger.log(
        `[${uploadId}] Pipeline complete in ${elapsed}s. Profile ${profileId} status=pending.`,
      );
    } catch (err) {
      const message = (err as Error).message;
      this.logger.error(`[${uploadId}] Pipeline failed: ${message}`);

      // Mark the upload record as failed so the UI can show an error state
      await this.profileBuilder.markUploadFailed(uploadId, message);

      // Re-throw so BullMQ records the failure and triggers retry if configured
      throw err;
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<ResumeJobData>, err: Error): void {
    this.logger.error(
      `Job ${job.id} for upload ${job.data.uploadId} failed after ${job.attemptsMade} attempt(s): ${err.message}`,
    );
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<ResumeJobData>): void {
    this.logger.log(`Job ${job.id} for upload ${job.data.uploadId} completed`);
  }
}
