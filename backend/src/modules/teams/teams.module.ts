import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TeamRequest } from './entities/team-request.entity';
import { TeamRole } from './entities/team-role.entity';
import { TeamRoleCandidate } from './entities/team-role-candidate.entity';
import { SkillProfile } from '../profiles/entities/skill-profile.entity';
import { TeamsController } from './teams.controller';
import { TeamsService } from './teams.service';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([TeamRequest, TeamRole, TeamRoleCandidate, SkillProfile]),
    AiModule,
  ],
  controllers: [TeamsController],
  providers: [TeamsService],
})
export class TeamsModule {}
