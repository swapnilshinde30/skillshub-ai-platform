import {
  Entity,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { BaseEntityNoUpdate } from '../../../common/entities/base.entity';
import { VectorTransformer } from '../../../common/transformers/vector.transformer';
import { TeamRequest } from './team-request.entity';
import { SkillProfile } from '../../profiles/entities/skill-profile.entity';
import { TeamRoleCandidate } from './team-role-candidate.entity';

@Entity('team_roles')
export class TeamRole extends BaseEntityNoUpdate {
  @Column({ name: 'team_request_id', type: 'uuid' })
  @Index()
  teamRequestId: string;

  @Column({ name: 'role_title', type: 'text' })
  roleTitle: string;

  @Column({ type: 'text' })
  requirements: string;

  @Column({
    name: 'requirements_embedding',
    type: 'text',
    nullable: true,
    transformer: VectorTransformer,
  })
  requirementsEmbedding: number[] | null;

  /** 1 = critical, 2 = important, 3 = nice-to-have */
  @Column({ type: 'int', default: 1 })
  priority: number;

  /** How many people are needed for this role */
  @Column({ type: 'int', default: 1 })
  headcount: number;

  @Column({ name: 'assigned_profile_id', type: 'uuid', nullable: true })
  assignedProfileId: string | null;

  @Column({ name: 'assignment_reasoning', type: 'text', nullable: true })
  assignmentReasoning: string | null;

  /** All HR-selected profile IDs for this role (supports headcount > 1) */
  @Column({ name: 'selected_candidate_ids', type: 'jsonb', default: [] })
  selectedCandidateIds: string[];

  // ── Relations ──────────────────────────────────────────────

  @ManyToOne(() => TeamRequest, (request) => request.roles, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'team_request_id' })
  teamRequest: TeamRequest;

  @ManyToOne(() => SkillProfile, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'assigned_profile_id' })
  assignedProfile: SkillProfile | null;

  @OneToMany(() => TeamRoleCandidate, (c) => c.role, { cascade: true })
  candidates: TeamRoleCandidate[];
}
