import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { SkillProfile } from '../entities/skill-profile.entity';
import { EmployeeSkill } from '../entities/employee-skill.entity';
import { Project } from '../entities/project.entity';
import { ProjectSkill } from '../entities/project-skill.entity';
import { Certification } from '../entities/certification.entity';
import { Education } from '../entities/education.entity';
import { ResumeUpload } from '../entities/resume-upload.entity';
import {
  ProfileExtraction,
  InferredSkill,
} from '../../ai/types/extraction-result.types';
import { ProfileStatus, SkillSource, UploadStatus } from '../../../common/enums';

@Injectable()
export class ProfileBuilderService {
  private readonly logger = new Logger(ProfileBuilderService.name);

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(SkillProfile)
    private readonly profileRepo: Repository<SkillProfile>,
    @InjectRepository(EmployeeSkill)
    private readonly skillRepo: Repository<EmployeeSkill>,
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
    @InjectRepository(ProjectSkill)
    private readonly projectSkillRepo: Repository<ProjectSkill>,
    @InjectRepository(Certification)
    private readonly certRepo: Repository<Certification>,
    @InjectRepository(Education)
    private readonly educationRepo: Repository<Education>,
    @InjectRepository(ResumeUpload)
    private readonly uploadRepo: Repository<ResumeUpload>,
  ) {}

  /**
   * Saves the full extracted + inferred profile inside a single transaction.
   * If the employee already has a profile, it is replaced (re-ingestion flow).
   * Returns the saved SkillProfile id.
   */
  async saveExtractedProfile(
    userId: string,
    uploadId: string,
    extraction: ProfileExtraction,
    inferred: InferredSkill[],
  ): Promise<string> {
    return this.dataSource.transaction(async (manager) => {
      // ── 1. Upsert skill profile ─────────────────────────────────────────
      let profile = await manager.findOneBy(SkillProfile, { userId });

      if (profile) {
        // Delete all child rows so we can replace them cleanly
        await manager.delete(EmployeeSkill, { profileId: profile.id });
        await manager.delete(Certification, { profileId: profile.id });
        await manager.delete(Education, { profileId: profile.id });
        // Projects cascade-delete their own ProjectSkills
        const existingProjects = await manager.findBy(Project, { profileId: profile.id });
        if (existingProjects.length) {
          await manager.delete(Project, { profileId: profile.id });
        }
      } else {
        profile = manager.create(SkillProfile, { userId });
      }

      profile.status = ProfileStatus.PENDING;
      profile.title = extraction.title;
      profile.summary = extraction.summary;
      profile.yearsTotal = extraction.yearsTotal;
      profile.source = 'resume';
      profile.reviewedAt = null;
      profile.reviewedBy = null;
      profile.reviewNotes = null;
      profile = await manager.save(SkillProfile, profile);

      // ── 2. Save explicit skills ─────────────────────────────────────────
      const skillEntities = extraction.skills.map((s) =>
        manager.create(EmployeeSkill, {
          profileId: profile.id,
          name: s.name,
          category: s.category,
          proficiency: s.proficiency,
          yearsExp: s.yearsExp,
          isInferred: false,
          source: SkillSource.RESUME,
        }),
      );
      await manager.save(EmployeeSkill, skillEntities);

      // ── 3. Save inferred skills ─────────────────────────────────────────
      if (inferred.length) {
        const inferredEntities = inferred.map((s) =>
          manager.create(EmployeeSkill, {
            profileId: profile.id,
            name: s.name,
            category: s.category,
            proficiency: s.proficiency,
            yearsExp: s.yearsExp,
            isInferred: true,
            inferenceConfidence: s.confidence,
            inferenceReasoning: s.reasoning,
            source: SkillSource.INFERRED,
          }),
        );
        await manager.save(EmployeeSkill, inferredEntities);
      }

      // ── 4. Save projects ────────────────────────────────────────────────
      for (const p of extraction.projects) {
        const project = await manager.save(
          Project,
          manager.create(Project, {
            profileId: profile.id,
            name: p.name,
            description: p.description,
            impact: p.impact,
            isCurrent: p.isCurrent,
            startDate: p.startDate ? new Date(p.startDate) : null,
            endDate: p.endDate ? new Date(p.endDate) : null,
          }),
        );

        if (p.techStack.length) {
          const projectSkills = p.techStack.map((skill) =>
            manager.create(ProjectSkill, {
              projectId: project.id,
              skillName: skill,
            }),
          );
          await manager.save(ProjectSkill, projectSkills);
        }
      }

      // ── 5. Save certifications ──────────────────────────────────────────
      if (extraction.certifications.length) {
        const certs = extraction.certifications.map((c) =>
          manager.create(Certification, {
            profileId: profile.id,
            name: c.name,
            issuer: c.issuer,
            issueDate: c.issueDate ? new Date(c.issueDate) : null,
            expiryDate: c.expiryDate ? new Date(c.expiryDate) : null,
            credentialId: c.credentialId,
          }),
        );
        await manager.save(Certification, certs);
      }

      // ── 6. Save education ───────────────────────────────────────────────
      if (extraction.education.length) {
        const edu = extraction.education.map((e) =>
          manager.create(Education, {
            profileId: profile.id,
            degree: e.degree,
            fieldOfStudy: e.fieldOfStudy,
            institution: e.institution,
            startYear: e.startYear,
            endYear: e.endYear,
            gpa: e.gpa,
          }),
        );
        await manager.save(Education, edu);
      }

      // ── 7. Mark upload as completed ─────────────────────────────────────
      await manager.update(ResumeUpload, uploadId, {
        processingStatus: UploadStatus.COMPLETED,
        profileId: profile.id,
        processedAt: new Date(),
      });

      this.logger.log(
        `Profile built for user ${userId}: ` +
        `${skillEntities.length} skills, ${inferred.length} inferred, ` +
        `${extraction.projects.length} projects`,
      );

      return profile.id;
    });
  }

  async markUploadFailed(uploadId: string, errorMessage: string): Promise<void> {
    await this.uploadRepo.update(uploadId, {
      processingStatus: UploadStatus.FAILED,
      errorMessage,
      processedAt: new Date(),
    });
  }
}
