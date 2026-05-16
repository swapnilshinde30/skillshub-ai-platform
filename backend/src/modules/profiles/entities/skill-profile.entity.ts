import {
  Entity,
  Column,
  OneToOne,
  OneToMany,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { ProfileStatus } from '../../../common/enums';
import { VectorTransformer } from '../../../common/transformers/vector.transformer';
import { User } from '../../users/entities/user.entity';
import { EmployeeSkill } from './employee-skill.entity';
import { Project } from './project.entity';
import { Certification } from './certification.entity';
import { Education } from './education.entity';
import { ResumeUpload } from './resume-upload.entity';

@Entity('skill_profiles')
export class SkillProfile extends BaseEntity {
  @Column({ name: 'user_id', type: 'uuid' })
  @Index({ unique: true })
  userId: string;

  @Column({
    type: 'enum',
    enum: ProfileStatus,
    default: ProfileStatus.DRAFT,
  })
  @Index()
  status: ProfileStatus;

  @Column({ type: 'text', nullable: true })
  title: string | null;

  @Column({ type: 'text', nullable: true })
  summary: string | null;

  @Column({ name: 'years_total', type: 'decimal', precision: 4, scale: 1, nullable: true })
  yearsTotal: number | null;

  @Column({ type: 'text', default: 'resume' })
  source: string;

  /**
   * Profile-level semantic embedding (1536-dim).
   * Stored as text in ORM layer; migration alters column to vector(1536).
   * Never query this field via ORM — always use raw SQL with <=> operator.
   */
  @Column({ type: 'text', nullable: true, transformer: VectorTransformer })
  embedding: number[] | null;

  @Column({ name: 'reviewed_by', type: 'uuid', nullable: true })
  reviewedBy: string | null;

  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true })
  reviewedAt: Date | null;

  @Column({ name: 'review_notes', type: 'text', nullable: true })
  reviewNotes: string | null;

  // ── Relations ──────────────────────────────────────────────

  @OneToOne(() => User, (user) => user.profile)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'reviewed_by' })
  reviewer: User | null;

  @OneToMany(() => EmployeeSkill, (skill) => skill.profile, { cascade: true })
  skills: EmployeeSkill[];

  @OneToMany(() => Project, (project) => project.profile, { cascade: true })
  projects: Project[];

  @OneToMany(() => Certification, (cert) => cert.profile, { cascade: true })
  certifications: Certification[];

  @OneToMany(() => Education, (edu) => edu.profile, { cascade: true })
  education: Education[];

  @OneToMany(() => ResumeUpload, (upload) => upload.profile)
  resumeUploads: ResumeUpload[];
}
