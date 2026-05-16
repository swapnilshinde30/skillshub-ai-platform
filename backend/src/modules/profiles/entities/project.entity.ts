import {
  Entity,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { BaseEntityNoUpdate } from '../../../common/entities/base.entity';
import { SkillProfile } from './skill-profile.entity';
import { ProjectSkill } from './project-skill.entity';

@Entity('projects')
export class Project extends BaseEntityNoUpdate {
  @Column({ name: 'profile_id', type: 'uuid' })
  @Index()
  profileId: string;

  @Column({ type: 'text' })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'text', nullable: true })
  impact: string | null;

  @Column({ type: 'text', nullable: true })
  url: string | null;

  @Column({ name: 'start_date', type: 'date', nullable: true })
  startDate: Date | null;

  @Column({ name: 'end_date', type: 'date', nullable: true })
  endDate: Date | null;

  @Column({ name: 'is_current', type: 'boolean', default: false })
  isCurrent: boolean;

  // ── Relations ──────────────────────────────────────────────

  @ManyToOne(() => SkillProfile, (profile) => profile.projects, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'profile_id' })
  profile: SkillProfile;

  @OneToMany(() => ProjectSkill, (ps) => ps.project, { cascade: true })
  skills: ProjectSkill[];
}
