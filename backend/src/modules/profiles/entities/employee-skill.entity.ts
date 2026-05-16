import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import {
  ProficiencyLevel,
  SkillSource,
  InferenceConfidence,
  SkillCategory,
} from '../../../common/enums';
import { VectorTransformer } from '../../../common/transformers/vector.transformer';
import { SkillProfile } from './skill-profile.entity';
import { SkillTaxonomy } from '../../taxonomy/entities/skill-taxonomy.entity';

@Entity('employee_skills')
@Unique(['profileId', 'name'])
export class EmployeeSkill extends BaseEntity {
  @Column({ name: 'profile_id', type: 'uuid' })
  @Index()
  profileId: string;

  @Column({ name: 'taxonomy_id', type: 'uuid', nullable: true })
  taxonomyId: string | null;

  @Column({ type: 'text' })
  name: string;

  @Column({
    type: 'enum',
    enum: SkillCategory,
    default: SkillCategory.OTHER,
  })
  category: SkillCategory;

  @Column({
    type: 'enum',
    enum: ProficiencyLevel,
    default: ProficiencyLevel.INTERMEDIATE,
  })
  proficiency: ProficiencyLevel;

  @Column({
    name: 'years_exp',
    type: 'decimal',
    precision: 4,
    scale: 1,
    default: 0,
  })
  yearsExp: number;

  @Column({ name: 'is_inferred', type: 'boolean', default: false })
  @Index()
  isInferred: boolean;

  @Column({
    name: 'inference_confidence',
    type: 'enum',
    enum: InferenceConfidence,
    nullable: true,
  })
  inferenceConfidence: InferenceConfidence | null;

  @Column({ name: 'inference_reasoning', type: 'text', nullable: true })
  inferenceReasoning: string | null;

  @Column({
    type: 'enum',
    enum: SkillSource,
    default: SkillSource.RESUME,
  })
  source: SkillSource;

  /**
   * Per-skill semantic embedding.
   * Built from: "{name}: {yearsExp} years, {proficiency} level"
   * Enables granular skill-level similarity search.
   */
  @Column({ type: 'text', nullable: true, transformer: VectorTransformer })
  embedding: number[] | null;

  // ── Relations ──────────────────────────────────────────────

  @ManyToOne(() => SkillProfile, (profile) => profile.skills, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'profile_id' })
  profile: SkillProfile;

  @ManyToOne(() => SkillTaxonomy, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'taxonomy_id' })
  taxonomy: SkillTaxonomy | null;
}
