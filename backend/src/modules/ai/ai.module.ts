import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiService } from './ai.service';
import { EmbeddingService } from './embedding.service';
import { SkillProfile } from '../profiles/entities/skill-profile.entity';
import { EmployeeSkill } from '../profiles/entities/employee-skill.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([SkillProfile, EmployeeSkill]),
  ],
  providers: [AiService, EmbeddingService],
  exports: [AiService, EmbeddingService],
})
export class AiModule {}
