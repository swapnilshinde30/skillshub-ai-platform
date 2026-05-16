import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { BaseEntityNoUpdate } from '../../../common/entities/base.entity';
import { UploadStatus } from '../../../common/enums';
import { User } from '../../users/entities/user.entity';
import { SkillProfile } from './skill-profile.entity';

@Entity('resume_uploads')
export class ResumeUpload extends BaseEntityNoUpdate {
  @Column({ name: 'user_id', type: 'uuid' })
  @Index()
  userId: string;

  @Column({ name: 'original_filename', type: 'text' })
  originalFilename: string;

  @Column({ name: 'file_size_bytes', type: 'int', nullable: true })
  fileSizeBytes: number | null;

  @Column({ name: 'mime_type', type: 'text', nullable: true })
  mimeType: string | null;

  /** Extracted text content sent to Claude for processing */
  @Column({ name: 'raw_text', type: 'text', nullable: true })
  rawText: string | null;

  @Column({
    name: 'processing_status',
    type: 'enum',
    enum: UploadStatus,
    default: UploadStatus.PENDING,
  })
  @Index()
  processingStatus: UploadStatus;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string | null;

  @Column({ name: 'processing_time_ms', type: 'int', nullable: true })
  processingTimeMs: number | null;

  @Column({ name: 'profile_id', type: 'uuid', nullable: true })
  profileId: string | null;

  @Column({ name: 'processed_at', type: 'timestamptz', nullable: true })
  processedAt: Date | null;

  // ── Relations ──────────────────────────────────────────────

  @ManyToOne(() => User, (user) => user.resumeUploads, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => SkillProfile, (profile) => profile.resumeUploads, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'profile_id' })
  profile: SkillProfile | null;
}
