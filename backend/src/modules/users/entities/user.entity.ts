import {
  Entity,
  Column,
  OneToOne,
  OneToMany,
  Index,
} from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { UserRole } from '../../../common/enums';
import { SkillProfile } from '../../profiles/entities/skill-profile.entity';
import { ResumeUpload } from '../../profiles/entities/resume-upload.entity';
import { SearchQuery } from '../../search/entities/search-query.entity';
import { TeamRequest } from '../../teams/entities/team-request.entity';

@Entity('users')
export class User extends BaseEntity {
  @Column({ type: 'text', unique: true })
  @Index()
  email: string;

  @Column({ name: 'password_hash', type: 'text', select: false })
  passwordHash: string;

  @Column({ type: 'text' })
  name: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.EMPLOYEE,
  })
  role: UserRole;

  @Column({ name: 'avatar_url', type: 'text', nullable: true })
  avatarUrl: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'last_login_at', type: 'timestamptz', nullable: true })
  lastLoginAt: Date | null;

  // ── Relations ──────────────────────────────────────────────

  @OneToOne(() => SkillProfile, (profile) => profile.user, { cascade: true })
  profile: SkillProfile;

  @OneToMany(() => ResumeUpload, (upload) => upload.user)
  resumeUploads: ResumeUpload[];

  @OneToMany(() => SearchQuery, (query) => query.hrUser)
  searchQueries: SearchQuery[];

  @OneToMany(() => TeamRequest, (team) => team.hrUser)
  teamRequests: TeamRequest[];
}
