import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntityNoUpdate } from '../../../common/entities/base.entity';
import { SkillProfile } from './skill-profile.entity';

@Entity('education')
export class Education extends BaseEntityNoUpdate {
  @Column({ name: 'profile_id', type: 'uuid' })
  @Index()
  profileId: string;

  @Column({ type: 'text' })
  degree: string;

  @Column({ name: 'field_of_study', type: 'text', nullable: true })
  fieldOfStudy: string | null;

  @Column({ type: 'text' })
  institution: string;

  @Column({ name: 'start_year', type: 'int', nullable: true })
  startYear: number | null;

  @Column({ name: 'end_year', type: 'int', nullable: true })
  endYear: number | null;

  @Column({ type: 'decimal', precision: 3, scale: 2, nullable: true })
  gpa: number | null;

  // ── Relations ──────────────────────────────────────────────

  @ManyToOne(() => SkillProfile, (profile) => profile.education, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'profile_id' })
  profile: SkillProfile;
}
