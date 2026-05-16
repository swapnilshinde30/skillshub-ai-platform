import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import * as bcrypt from 'bcrypt';
import { Queue } from 'bullmq';
import { Repository } from 'typeorm';
import { SkillProfile } from './entities/skill-profile.entity';
import { EmployeeSkill } from './entities/employee-skill.entity';
import { Project } from './entities/project.entity';
import { Certification } from './entities/certification.entity';
import { Education } from './entities/education.entity';
import { ResumeUpload } from './entities/resume-upload.entity';
import { PdfExtractorService } from './services/pdf-extractor.service';
import { EmbeddingService } from '../ai/embedding.service';
import { ProfileBuilderService } from './services/profile-builder.service';
import { UsersService } from '../users/users.service';
import {
  IngestResponseDto,
  IngestionStatusDto,
} from './dto/ingest.dto';
import {
  UpdateProfileDto,
  ApproveProfileDto,
  RejectProfileDto,
} from './dto/review-profile.dto';
import { ProfileStatus, SkillSource, UploadStatus, UserRole } from '../../common/enums';
import { JwtPayload } from '../auth/dto/jwt-payload.interface';
import { RESUME_QUEUE, RESUME_JOB, ResumeJobData } from './processors/resume.processor';

@Injectable()
export class ProfilesService {
  private readonly logger = new Logger(ProfilesService.name);

  constructor(
    @InjectRepository(SkillProfile)
    private readonly profileRepo: Repository<SkillProfile>,
    @InjectRepository(EmployeeSkill)
    private readonly skillRepo: Repository<EmployeeSkill>,
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
    @InjectRepository(Certification)
    private readonly certRepo: Repository<Certification>,
    @InjectRepository(Education)
    private readonly eduRepo: Repository<Education>,
    @InjectRepository(ResumeUpload)
    private readonly uploadRepo: Repository<ResumeUpload>,
    @InjectQueue(RESUME_QUEUE)
    private readonly resumeQueue: Queue<ResumeJobData>,
    private readonly pdfExtractor: PdfExtractorService,
    private readonly embeddingService: EmbeddingService,
    private readonly profileBuilder: ProfileBuilderService,
    private readonly usersService: UsersService,
  ) {}

  // ── Ingestion ────────────────────────────────────────────────────────────

  async ingestPdf(
    file: Express.Multer.File,
    userId: string,
  ): Promise<IngestResponseDto> {
    const rawText = await this.pdfExtractor.extractText(file);
    return this.enqueueIngestion(userId, file.originalname, rawText);
  }

  async ingestText(
    rawText: string,
    userId: string,
  ): Promise<IngestResponseDto> {
    const cleaned = this.pdfExtractor.extractFromText(rawText);
    return this.enqueueIngestion(userId, 'linkedin-paste.txt', cleaned);
  }

  async ingestLinkedIn(
    url: string | undefined,
    pastedText: string | undefined,
    userId: string,
  ): Promise<IngestResponseDto> {
    let profileText: string;

    if (pastedText && pastedText.trim().length >= 100) {
      // Path A: user manually copied their profile — clean and use it directly
      profileText = this.pdfExtractor.extractFromText(pastedText);
    } else if (url) {
      // Path B: attempt to fetch the public LinkedIn profile page by URL
      profileText = await this.fetchLinkedInPage(url);
    } else {
      throw new Error(
        'Please either provide a LinkedIn profile URL or paste your profile content.',
      );
    }

    // Prefix with LinkedIn context so the AI pipeline knows the source format
    const lines = ['=== LINKEDIN PROFILE IMPORT ==='];
    if (url) lines.push(`Source URL: ${url}`);
    lines.push('', profileText);

    return this.enqueueIngestion(userId, 'linkedin-profile.txt', lines.join('\n'));
  }

  // ── HR: find or create an employee account ───────────────────────────────

  async findOrCreateEmployee(
    email: string,
    name?: string,
  ): Promise<{ userId: string; isNewAccount: boolean }> {
    const existing = await this.usersService.findByEmail(email);
    if (existing) return { userId: existing.id, isNewAccount: false };

    const passwordHash = await bcrypt.hash('demo1234', 12);
    const user = await this.usersService.create({
      name: name ?? email.split('@')[0],
      email,
      passwordHash,
      role: UserRole.EMPLOYEE,
    });
    this.logger.log(`HR created employee account: ${email}`);
    return { userId: user.id, isNewAccount: true };
  }

  // ── HR: ingest on behalf of a specific employee ──────────────────────────

  async hrIngestPdf(
    file: Express.Multer.File,
    targetEmail: string,
    targetName?: string,
  ): Promise<IngestResponseDto> {
    const { userId } = await this.findOrCreateEmployee(targetEmail, targetName);
    const rawText = await this.pdfExtractor.extractText(file);
    return this.enqueueIngestion(userId, file.originalname, rawText);
  }

  async hrIngestText(
    rawText: string,
    targetEmail: string,
    targetName?: string,
  ): Promise<IngestResponseDto> {
    const { userId } = await this.findOrCreateEmployee(targetEmail, targetName);
    const cleaned = this.pdfExtractor.extractFromText(rawText);
    return this.enqueueIngestion(userId, 'hr-paste.txt', cleaned);
  }

  async hrIngestLinkedIn(
    url: string | undefined,
    pastedText: string | undefined,
    targetEmail: string,
    targetName?: string,
  ): Promise<IngestResponseDto> {
    const { userId } = await this.findOrCreateEmployee(targetEmail, targetName);

    let profileText: string;
    if (pastedText && pastedText.trim().length >= 100) {
      profileText = this.pdfExtractor.extractFromText(pastedText);
    } else if (url) {
      profileText = await this.fetchLinkedInPage(url);
    } else {
      throw new Error('Provide a LinkedIn URL or paste the profile text.');
    }

    const lines = ['=== LINKEDIN PROFILE IMPORT (HR) ==='];
    if (url) lines.push(`Source URL: ${url}`);
    lines.push('', profileText);
    return this.enqueueIngestion(userId, 'hr-linkedin.txt', lines.join('\n'));
  }

  private async fetchLinkedInPage(url: string): Promise<string> {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
            '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
          Accept: 'text/html,application/xhtml+xml',
        },
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const html = await response.text();

      // Strip tags and collapse whitespace into readable lines
      const text = html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&nbsp;/g, ' ')
        .replace(/&#?\w+;/g, ' ')
        .replace(/\s{2,}/g, '\n')
        .trim();

      if (text.length < 200) {
        throw new Error('Fetched page appears empty — LinkedIn may require login');
      }

      return text;
    } catch (err) {
      const msg = (err as Error).message;
      this.logger.warn(`LinkedIn fetch failed for ${url}: ${msg}`);
      throw new Error(
        'Could not auto-fetch your LinkedIn profile (LinkedIn requires login for full access). ' +
        'Please paste your profile text using the manual copy guide.',
      );
    }
  }

  async enqueueIngestion(
    userId: string,
    filename: string,
    rawText: string,
  ): Promise<IngestResponseDto> {
    // Save upload record immediately so the user can poll its status
    const upload = await this.uploadRepo.save(
      this.uploadRepo.create({
        userId,
        originalFilename: filename,
        rawText,
        fileSizeBytes: Buffer.byteLength(rawText, 'utf8'),
        processingStatus: UploadStatus.PROCESSING,
      }),
    );

    // Enqueue background job with retry + backoff
    await this.resumeQueue.add(
      RESUME_JOB,
      { uploadId: upload.id, userId, rawText },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: false,   // keep for status polling
        removeOnFail: false,
      },
    );

    this.logger.log(`Enqueued resume processing: upload=${upload.id} user=${userId}`);

    return {
      uploadId: upload.id,
      status: 'processing',
      message: 'Resume received and queued for processing. Poll /ingest/status/:uploadId for updates.',
    };
  }

  // ── Status polling ───────────────────────────────────────────────────────

  async getIngestionStatus(
    uploadId: string,
    userId: string,
  ): Promise<IngestionStatusDto> {
    const upload = await this.uploadRepo.findOneBy({ id: uploadId });

    if (!upload || upload.userId !== userId) {
      throw new NotFoundException('Upload not found');
    }

    // Try to get live progress from BullMQ job
    let progress = 0;
    const waitingJobs = await this.resumeQueue.getJobs(['active', 'waiting', 'delayed']);
    const liveJob = waitingJobs.find((j) => j.data.uploadId === uploadId);
    if (liveJob) {
      progress = typeof liveJob.progress === 'number' ? liveJob.progress : 0;
    } else if (upload.processingStatus === UploadStatus.COMPLETED) {
      progress = 100;
    }

    return {
      uploadId,
      status: upload.processingStatus as IngestionStatusDto['status'],
      progress,
      profileId: upload.profileId ?? null,
      errorMessage: upload.errorMessage ?? null,
      processingTimeMs: upload.processingTimeMs ?? null,
    };
  }

  // ── Employee: own profile ────────────────────────────────────────────────

  async getMyProfile(userId: string): Promise<SkillProfile> {
    const profile = await this.profileRepo.findOne({
      where: { userId },
      relations: ['skills', 'projects', 'projects.skills', 'certifications', 'education'],
    });
    if (!profile) throw new NotFoundException('No profile found. Upload a resume to get started.');
    return profile;
  }

  async updateMyProfile(userId: string, dto: UpdateProfileDto): Promise<SkillProfile> {
    const profile = await this.profileRepo.findOneBy({ userId });
    if (!profile) throw new NotFoundException('Profile not found');

    if (dto.title !== undefined)      profile.title      = dto.title;
    if (dto.summary !== undefined)    profile.summary    = dto.summary;
    if (dto.yearsTotal !== undefined) profile.yearsTotal = dto.yearsTotal;

    await this.profileRepo.save(profile);

    if (dto.skills !== undefined) {
      await this.skillRepo.delete({ profileId: profile.id });
      if (dto.skills.length > 0) {
        const skills = dto.skills.map((s) =>
          this.skillRepo.create({
            profileId: profile.id,
            name: s.name,
            category: s.category,
            proficiency: s.proficiency,
            yearsExp: s.yearsExp,
            source: SkillSource.MANUAL,
          }),
        );
        await this.skillRepo.save(skills);
      }
      this.embeddingService
        .generateAndSaveSkillEmbeddings(profile.id)
        .catch((err) => this.logger.error(`Skill embedding update failed: ${err.message}`));
    }

    if (dto.projects !== undefined) {
      await this.projectRepo.delete({ profileId: profile.id });
      if (dto.projects.length > 0) {
        await this.projectRepo.save(
          dto.projects.map((p) =>
            this.projectRepo.create({
              profileId: profile.id,
              name: p.name,
              description: p.description ?? null,
              impact: p.impact ?? null,
              url: p.url ?? null,
              isCurrent: p.isCurrent ?? false,
            }),
          ),
        );
      }
    }

    if (dto.certifications !== undefined) {
      await this.certRepo.delete({ profileId: profile.id });
      if (dto.certifications.length > 0) {
        await this.certRepo.save(
          dto.certifications.map((c) =>
            this.certRepo.create({
              profileId: profile.id,
              name: c.name,
              issuer: c.issuer ?? null,
              issueDate: c.issueDate ? new Date(c.issueDate) : null,
            }),
          ),
        );
      }
    }

    if (dto.education !== undefined) {
      await this.eduRepo.delete({ profileId: profile.id });
      if (dto.education.length > 0) {
        await this.eduRepo.save(
          dto.education.map((e) =>
            this.eduRepo.create({
              profileId: profile.id,
              degree: e.degree,
              fieldOfStudy: e.fieldOfStudy ?? null,
              institution: e.institution,
              startYear: e.startYear ?? null,
              endYear: e.endYear ?? null,
            }),
          ),
        );
      }
    }

    this.embeddingService
      .generateAndSaveProfileEmbedding(profile.id)
      .catch((err) => this.logger.error(`Embedding update failed: ${err.message}`));

    return this.getMyProfile(userId);
  }

  async submitForApproval(userId: string): Promise<SkillProfile> {
    const profile = await this.profileRepo.findOneBy({ userId });
    if (!profile) throw new NotFoundException('Profile not found');
    if (profile.status !== ProfileStatus.DRAFT && profile.status !== ProfileStatus.REJECTED) {
      throw new ForbiddenException('Only draft or rejected profiles can be submitted for approval');
    }
    profile.status = ProfileStatus.PENDING;
    return this.profileRepo.save(profile);
  }

  async updateProfileByIdAsHr(id: string, dto: UpdateProfileDto): Promise<SkillProfile> {
    const profile = await this.profileRepo.findOneBy({ id });
    if (!profile) throw new NotFoundException('Profile not found');

    if (dto.title !== undefined)      profile.title      = dto.title;
    if (dto.summary !== undefined)    profile.summary    = dto.summary;
    if (dto.yearsTotal !== undefined) profile.yearsTotal = dto.yearsTotal;

    await this.profileRepo.save(profile);

    if (dto.skills !== undefined) {
      await this.skillRepo.delete({ profileId: id });
      if (dto.skills.length > 0) {
        const skills = dto.skills.map((s) =>
          this.skillRepo.create({
            profileId: id,
            name: s.name,
            category: s.category,
            proficiency: s.proficiency,
            yearsExp: s.yearsExp,
            source: SkillSource.MANUAL,
          }),
        );
        await this.skillRepo.save(skills);
      }
    }

    if (dto.projects !== undefined) {
      await this.projectRepo.delete({ profileId: id });
      if (dto.projects.length > 0) {
        await this.projectRepo.save(
          dto.projects.map((p) =>
            this.projectRepo.create({
              profileId: id,
              name: p.name,
              description: p.description ?? null,
              impact: p.impact ?? null,
              url: p.url ?? null,
              isCurrent: p.isCurrent ?? false,
            }),
          ),
        );
      }
    }

    if (dto.certifications !== undefined) {
      await this.certRepo.delete({ profileId: id });
      if (dto.certifications.length > 0) {
        await this.certRepo.save(
          dto.certifications.map((c) =>
            this.certRepo.create({
              profileId: id,
              name: c.name,
              issuer: c.issuer ?? null,
              issueDate: c.issueDate ? new Date(c.issueDate) : null,
            }),
          ),
        );
      }
    }

    if (dto.education !== undefined) {
      await this.eduRepo.delete({ profileId: id });
      if (dto.education.length > 0) {
        await this.eduRepo.save(
          dto.education.map((e) =>
            this.eduRepo.create({
              profileId: id,
              degree: e.degree,
              fieldOfStudy: e.fieldOfStudy ?? null,
              institution: e.institution,
              startYear: e.startYear ?? null,
              endYear: e.endYear ?? null,
            }),
          ),
        );
      }
    }

    this.embeddingService
      .generateAndSaveProfileEmbedding(id)
      .catch((err) => this.logger.error(`Embedding update failed: ${err.message}`));
    this.embeddingService
      .generateAndSaveSkillEmbeddings(id)
      .catch((err) => this.logger.error(`Skill embedding update failed: ${err.message}`));

    return this.getProfileById(id);
  }

  async deleteProfile(id: string): Promise<void> {
    const profile = await this.profileRepo.findOneBy({ id });
    if (!profile) throw new NotFoundException('Profile not found');
    await this.profileRepo.remove(profile);
    this.logger.log(`Profile ${id} deleted`);
  }

  // ── HR: list and review profiles ─────────────────────────────────────────

  async listProfiles(
    status?: ProfileStatus,
    page = 1,
    limit = 20,
  ): Promise<{ profiles: SkillProfile[]; total: number }> {
    const qb = this.profileRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.user', 'u')
      .leftJoinAndSelect('p.skills', 's')
      .leftJoinAndSelect('p.certifications', 'c')
      .orderBy('p.updatedAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (status) qb.where('p.status = :status', { status });

    const [profiles, total] = await qb.getManyAndCount();
    return { profiles, total };
  }

  async getProfileById(id: string): Promise<SkillProfile> {
    const profile = await this.profileRepo.findOne({
      where: { id },
      relations: ['user', 'skills', 'projects', 'projects.skills', 'certifications', 'education'],
    });
    if (!profile) throw new NotFoundException('Profile not found');
    return profile;
  }

  async approveProfile(
    profileId: string,
    reviewerId: string,
    dto: ApproveProfileDto,
  ): Promise<SkillProfile> {
    const profile = await this.profileRepo.findOneBy({ id: profileId });
    if (!profile) throw new NotFoundException('Profile not found');

    profile.status      = ProfileStatus.APPROVED;
    profile.reviewedBy  = reviewerId;
    profile.reviewedAt  = new Date();
    profile.reviewNotes = dto.notes ?? null;
    await this.profileRepo.save(profile);

    // Ensure embeddings are current at approval time
    this.embeddingService
      .generateAndSaveProfileEmbedding(profileId)
      .catch((err) => this.logger.error(`Post-approval embedding failed: ${err.message}`));

    this.logger.log(`Profile ${profileId} approved by ${reviewerId}`);
    return profile;
  }

  async rejectProfile(
    profileId: string,
    reviewerId: string,
    dto: RejectProfileDto,
  ): Promise<SkillProfile> {
    const profile = await this.profileRepo.findOneBy({ id: profileId });
    if (!profile) throw new NotFoundException('Profile not found');

    profile.status      = ProfileStatus.REJECTED;
    profile.reviewedBy  = reviewerId;
    profile.reviewedAt  = new Date();
    profile.reviewNotes = dto.reason;
    await this.profileRepo.save(profile);

    this.logger.log(`Profile ${profileId} rejected by ${reviewerId}`);
    return profile;
  }

  // ── Shared guard: HR may access any profile, employee only their own ─────

  assertCanAccess(profile: SkillProfile, requester: JwtPayload): void {
    if (requester.role === UserRole.HR) return;
    if (profile.userId !== requester.sub) {
      throw new ForbiddenException('You can only access your own profile');
    }
  }
}
