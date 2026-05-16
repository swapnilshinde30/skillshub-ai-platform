import 'dotenv/config';
import { DataSource, DataSourceOptions } from 'typeorm';
import { User } from '../modules/users/entities/user.entity';
import { SkillProfile } from '../modules/profiles/entities/skill-profile.entity';
import { EmployeeSkill } from '../modules/profiles/entities/employee-skill.entity';
import { Project } from '../modules/profiles/entities/project.entity';
import { ProjectSkill } from '../modules/profiles/entities/project-skill.entity';
import { ResumeUpload } from '../modules/profiles/entities/resume-upload.entity';
import { Certification } from '../modules/profiles/entities/certification.entity';
import { Education } from '../modules/profiles/entities/education.entity';
import { SkillTaxonomy } from '../modules/taxonomy/entities/skill-taxonomy.entity';
import { SearchQuery } from '../modules/search/entities/search-query.entity';
import { SearchResult } from '../modules/search/entities/search-result.entity';
import { TeamRequest } from '../modules/teams/entities/team-request.entity';
import { TeamRole } from '../modules/teams/entities/team-role.entity';
import { TeamRoleCandidate } from '../modules/teams/entities/team-role-candidate.entity';

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [
    User,
    SkillProfile,
    EmployeeSkill,
    Project,
    ProjectSkill,
    ResumeUpload,
    Certification,
    Education,
    SkillTaxonomy,
    SearchQuery,
    SearchResult,
    TeamRequest,
    TeamRole,
    TeamRoleCandidate,
  ],
  migrations: ['dist/database/migrations/*.js'],
  // Never use synchronize: true in production — use migrations only
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
};

// Standalone DataSource for CLI migrations (typeorm migration:run)
const AppDataSource = new DataSource(dataSourceOptions);
export default AppDataSource;
