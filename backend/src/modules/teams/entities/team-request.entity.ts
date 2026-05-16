import {
  Entity,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { TeamStatus } from '../../../common/enums';
import { User } from '../../users/entities/user.entity';
import { TeamRole } from './team-role.entity';

@Entity('team_requests')
export class TeamRequest extends BaseEntity {
  @Column({ name: 'hr_user_id', type: 'uuid' })
  @Index()
  hrUserId: string;

  @Column({ name: 'project_name', type: 'text' })
  projectName: string;

  @Column({ name: 'project_description', type: 'text', nullable: true })
  projectDescription: string | null;

  @Column({
    type: 'enum',
    enum: TeamStatus,
    default: TeamStatus.DRAFT,
  })
  status: TeamStatus;

  /** Claude's overall assessment of the assembled team */
  @Column({ name: 'ai_summary', type: 'text', nullable: true })
  aiSummary: string | null;

  /** Skills not fully covered by the suggested team */
  @Column({ name: 'coverage_gaps', type: 'jsonb', default: [] })
  coverageGaps: string[];

  // ── Relations ──────────────────────────────────────────────

  @ManyToOne(() => User, (user) => user.teamRequests, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'hr_user_id' })
  hrUser: User;

  @OneToMany(() => TeamRole, (role) => role.teamRequest, { cascade: true })
  roles: TeamRole[];
}
