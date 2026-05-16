import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntityNoUpdate } from '../../../common/entities/base.entity';
import { TeamRole } from './team-role.entity';
import { SkillProfile } from '../../profiles/entities/skill-profile.entity';

/**
 * Stores AI-matched candidate suggestions per role.
 * Populated by buildTeam; HR selects one to assign.
 */
@Entity('team_role_candidates')
export class TeamRoleCandidate extends BaseEntityNoUpdate {
  @Column({ name: 'team_role_id', type: 'uuid' })
  @Index()
  teamRoleId: string;

  @Column({ name: 'profile_id', type: 'uuid' })
  profileId: string;

  /** AI match score 0–100 */
  @Column({ type: 'float', default: 0 })
  score: number;

  /** Why the AI suggested this person for this role */
  @Column({ type: 'text', nullable: true })
  reasoning: string | null;

  /** 1 = best match, ascending */
  @Column({ type: 'int', default: 1 })
  rank: number;

  @ManyToOne(() => TeamRole, (role) => role.candidates, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'team_role_id' })
  role: TeamRole;

  @ManyToOne(() => SkillProfile, { nullable: false, onDelete: 'CASCADE', eager: false })
  @JoinColumn({ name: 'profile_id' })
  profile: SkillProfile;
}
