import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntityNoUpdate } from '../../../common/entities/base.entity';
import { SkillProfile } from './skill-profile.entity';

@Entity('certifications')
export class Certification extends BaseEntityNoUpdate {
  @Column({ name: 'profile_id', type: 'uuid' })
  @Index()
  profileId: string;

  @Column({ type: 'text' })
  name: string;

  @Column({ type: 'text', nullable: true })
  issuer: string | null;

  @Column({ name: 'issue_date', type: 'date', nullable: true })
  issueDate: Date | null;

  @Column({ name: 'expiry_date', type: 'date', nullable: true })
  expiryDate: Date | null;

  @Column({ name: 'credential_id', type: 'text', nullable: true })
  credentialId: string | null;

  @Column({ name: 'credential_url', type: 'text', nullable: true })
  credentialUrl: string | null;

  // ── Relations ──────────────────────────────────────────────

  @ManyToOne(() => SkillProfile, (profile) => profile.certifications, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'profile_id' })
  profile: SkillProfile;
}
