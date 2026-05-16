import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { BaseEntityNoUpdate } from '../../../common/entities/base.entity';
import { SearchRecommendation } from '../../../common/enums';
import { SearchQuery } from './search-query.entity';
import { SkillProfile } from '../../profiles/entities/skill-profile.entity';

@Entity('search_results')
export class SearchResult extends BaseEntityNoUpdate {
  @Column({ name: 'query_id', type: 'uuid' })
  @Index()
  queryId: string;

  @Column({ name: 'profile_id', type: 'uuid' })
  @Index()
  profileId: string;

  @Column({ name: 'rank_position', type: 'int' })
  rankPosition: number;

  /** Cosine similarity from pgvector (0–1) */
  @Column({ name: 'vector_score', type: 'decimal', precision: 6, scale: 5, nullable: true })
  vectorScore: number | null;

  /** Claude's 0–100 relevance score */
  @Column({ name: 'claude_score', type: 'decimal', precision: 5, scale: 2, nullable: true })
  claudeScore: number | null;

  /** Weighted composite: vectorScore*0.4 + claudeScore/100*0.5 + recency*0.1 */
  @Column({ name: 'final_score', type: 'decimal', precision: 6, scale: 5, nullable: true })
  finalScore: number | null;

  /** Claude's natural-language explanation of why this person matches */
  @Column({ type: 'text', nullable: true })
  reasoning: string | null;

  @Column({ type: 'jsonb', default: [] })
  strengths: string[];

  @Column({ type: 'jsonb', default: [] })
  gaps: string[];

  @Column({
    type: 'enum',
    enum: SearchRecommendation,
    default: SearchRecommendation.PARTIAL_MATCH,
  })
  recommendation: SearchRecommendation;

  // ── Relations ──────────────────────────────────────────────

  @ManyToOne(() => SearchQuery, (query) => query.results, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'query_id' })
  query: SearchQuery;

  @ManyToOne(() => SkillProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'profile_id' })
  profile: SkillProfile;
}
