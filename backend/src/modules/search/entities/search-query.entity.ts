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
import { User } from '../../users/entities/user.entity';
import { SearchResult } from './search-result.entity';

@Entity('search_queries')
export class SearchQuery extends BaseEntityNoUpdate {
  @Column({ name: 'hr_user_id', type: 'uuid' })
  @Index()
  hrUserId: string;

  @Column({ name: 'query_text', type: 'text' })
  queryText: string;

  /**
   * Embedded query vector — enables "find previous queries similar to this one"
   * and future analytics on search patterns.
   */
  @Column({ name: 'query_embedding', type: 'text', nullable: true, transformer: VectorTransformer })
  queryEmbedding: number[] | null;

  /** Structured filters applied alongside the semantic query */
  @Column({ type: 'jsonb', default: {} })
  filters: Record<string, unknown>;

  @Column({ name: 'result_count', type: 'int', default: 0 })
  resultCount: number;

  @Column({ name: 'execution_time_ms', type: 'int', nullable: true })
  executionTimeMs: number | null;

  // ── Relations ──────────────────────────────────────────────

  @ManyToOne(() => User, (user) => user.searchQueries, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'hr_user_id' })
  hrUser: User;

  @OneToMany(() => SearchResult, (result) => result.query, { cascade: true })
  results: SearchResult[];
}
