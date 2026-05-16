import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { BaseEntityNoUpdate } from '../../../common/entities/base.entity';
import { Project } from './project.entity';
import { SkillTaxonomy } from '../../taxonomy/entities/skill-taxonomy.entity';

@Entity('project_skills')
@Unique(['projectId', 'skillName'])
export class ProjectSkill extends BaseEntityNoUpdate {
  @Column({ name: 'project_id', type: 'uuid' })
  @Index()
  projectId: string;

  @Column({ name: 'skill_name', type: 'text' })
  skillName: string;

  @Column({ name: 'taxonomy_id', type: 'uuid', nullable: true })
  taxonomyId: string | null;

  // ── Relations ──────────────────────────────────────────────

  @ManyToOne(() => Project, (project) => project.skills, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @ManyToOne(() => SkillTaxonomy, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'taxonomy_id' })
  taxonomy: SkillTaxonomy | null;
}
