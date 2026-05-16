import {
  Entity,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { BaseEntityNoUpdate } from '../../../common/entities/base.entity';
import { SkillCategory } from '../../../common/enums';
import { VectorTransformer } from '../../../common/transformers/vector.transformer';

@Entity('skill_taxonomy')
export class SkillTaxonomy extends BaseEntityNoUpdate {
  @Column({ type: 'text' })
  name: string;

  @Column({ name: 'normalized_name', type: 'text', unique: true })
  normalizedName: string;

  @Column({
    type: 'enum',
    enum: SkillCategory,
    default: SkillCategory.OTHER,
  })
  @Index()
  category: SkillCategory;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'parent_id', type: 'uuid', nullable: true })
  parentId: string | null;

  /** Alternative names: ["TS", "Typescript", "ts"] */
  @Column({ type: 'jsonb', default: [] })
  aliases: string[];

  @Column({ name: 'is_verified', type: 'boolean', default: false })
  isVerified: boolean;

  /** Incremented each time an employee is linked to this skill */
  @Column({ name: 'usage_count', type: 'int', default: 0 })
  usageCount: number;

  /** Used for "similar skills" suggestions */
  @Column({ type: 'text', nullable: true, transformer: VectorTransformer })
  embedding: number[] | null;

  // ── Relations ──────────────────────────────────────────────

  @ManyToOne(() => SkillTaxonomy, (taxonomy) => taxonomy.children, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'parent_id' })
  parent: SkillTaxonomy | null;

  @OneToMany(() => SkillTaxonomy, (taxonomy) => taxonomy.parent)
  children: SkillTaxonomy[];
}
