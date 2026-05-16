import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { ProfilesController } from './profiles.controller';
import { ProfilesService } from './profiles.service';
import { PdfExtractorService } from './services/pdf-extractor.service';
import { ProfileBuilderService } from './services/profile-builder.service';
import { BulkImportService } from './services/bulk-import.service';
import { ResumeProcessor, RESUME_QUEUE } from './processors/resume.processor';
import { AiModule } from '../ai/ai.module';
import { UsersModule } from '../users/users.module';
import { SkillProfile } from './entities/skill-profile.entity';
import { EmployeeSkill } from './entities/employee-skill.entity';
import { Project } from './entities/project.entity';
import { ProjectSkill } from './entities/project-skill.entity';
import { Certification } from './entities/certification.entity';
import { Education } from './entities/education.entity';
import { ResumeUpload } from './entities/resume-upload.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SkillProfile,
      EmployeeSkill,
      Project,
      ProjectSkill,
      Certification,
      Education,
      ResumeUpload,
    ]),

    BullModule.registerQueue({
      name: RESUME_QUEUE,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5_000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 50 },
      },
    }),

    AiModule,
    UsersModule,
  ],
  controllers: [ProfilesController],
  providers: [
    ProfilesService,
    PdfExtractorService,
    ProfileBuilderService,
    BulkImportService,
    ResumeProcessor,
  ],
  exports: [ProfilesService],
})
export class ProfilesModule {}
