import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { EmbeddingService } from '../../ai/embedding.service';
import { UnderstoodQuery, CandidateForRanking } from '../types/search.types';

/** Maximum candidates returned from vector search before structured filtering */
const VECTOR_POOL_SIZE = 50;

/** Maximum candidates forwarded to Claude for re-ranking (token budget limit) */
export const RERANK_POOL_SIZE = 15;

interface VectorRow {
  id: string;
  user_id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  title: string;
  summary: string | null;
  years_total: number;
  updated_at: Date;
  vector_score: number;
}

interface SkillRow {
  profile_id: string;
  name: string;
  years_exp: number;
  proficiency: string;
  is_inferred: boolean;
}

interface ProjectRow {
  profile_id: string;
  name: string;
  description: string | null;
  impact: string | null;
}

interface CertRow {
  profile_id: string;
  name: string;
}

@Injectable()
export class VectorSearcherService {
  private readonly logger = new Logger(VectorSearcherService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly embeddingService: EmbeddingService,
  ) {}

  /**
   * Three-phase retrieval:
   *   1. Embed the enriched query text.
   *   2. pgvector HNSW cosine similarity → top VECTOR_POOL_SIZE candidates.
   *   3. Structured filtering (min years, required skill names) → RERANK_POOL_SIZE.
   */
  async retrieveCandidates(
    understood: UnderstoodQuery,
  ): Promise<CandidateForRanking[]> {
    // Phase 1: embed (may return zero vector if embeddings unavailable)
    const queryEmbedding = await this.embeddingService.embed(
      understood.embeddingText,
    );

    const isZeroVector = queryEmbedding.every((v) => v === 0);
    const embeddingLiteral = `[${queryEmbedding.join(',')}]`;

    // Phase 2: vector search (fall back to all approved profiles when embeddings unavailable)
    const vectorRows = isZeroVector
      ? await this.fallbackSearch()
      : await this.vectorSearch(embeddingLiteral);
    this.logger.log(
      `${isZeroVector ? 'Fallback' : 'Vector'} search returned ${vectorRows.length} candidates`,
    );

    if (!vectorRows.length) return [];

    // Phase 3a: filter by min years (no slice yet — skill filter comes after hydration)
    const afterYears = this.applyMinYearsFilter(vectorRows, understood);
    this.logger.log(`After minYears filter: ${afterYears.length} candidates`);

    // Hydrate a larger pool so skill filtering has enough candidates to choose from
    const hydratePool = afterYears.slice(0, RERANK_POOL_SIZE * 2);
    const profileIds = hydratePool.map((r) => r.id);
    const [skillRows, projectRows, certRows] = await Promise.all([
      this.fetchSkills(profileIds),
      this.fetchProjects(profileIds),
      this.fetchCerts(profileIds),
    ]);

    // Phase 3b: filter by required skills now that we have skill data
    const skillMap = this.groupBy(skillRows, 'profile_id');
    const afterSkills = this.applyRequiredSkillsFilter(hydratePool, skillMap, understood);
    this.logger.log(
      `After skill filter: ${afterSkills.length} candidates → slicing to pool=${RERANK_POOL_SIZE}`,
    );

    const finalPool = afterSkills.slice(0, RERANK_POOL_SIZE);
    return this.buildCandidateList(finalPool, skillRows, projectRows, certRows);
  }

  // ── pgvector similarity query ────────────────────────────────────────────

  private async fallbackSearch(): Promise<VectorRow[]> {
    return this.dataSource.query<VectorRow[]>(
      `
      SELECT
        sp.id,
        sp.user_id,
        u.name,
        u.email,
        u.avatar_url,
        sp.title,
        sp.summary,
        CAST(sp.years_total AS FLOAT) AS years_total,
        sp.updated_at,
        0.5                           AS vector_score
      FROM skill_profiles sp
      JOIN users u ON u.id = sp.user_id
      WHERE sp.status = 'approved'
      ORDER BY sp.updated_at DESC
      LIMIT $1
      `,
      [VECTOR_POOL_SIZE],
    );
  }

  private async vectorSearch(embeddingLiteral: string): Promise<VectorRow[]> {
    /**
     * <=> is the pgvector cosine DISTANCE operator.
     * Distance = 1 - similarity, so ORDER BY distance ASC = most similar first.
     * We subtract from 1 to convert distance to similarity score (0–1).
     *
     * The HNSW index on skill_profiles.embedding makes this O(log n) instead of O(n).
     */
    return this.dataSource.query<VectorRow[]>(
      `
      SELECT
        sp.id,
        sp.user_id,
        u.name,
        u.email,
        u.avatar_url,
        sp.title,
        sp.summary,
        CAST(sp.years_total AS FLOAT)      AS years_total,
        sp.updated_at,
        1 - (sp.embedding <=> $1::vector)  AS vector_score
      FROM skill_profiles sp
      JOIN users u ON u.id = sp.user_id
      WHERE sp.status = 'approved'
        AND sp.embedding IS NOT NULL
      ORDER BY sp.embedding <=> $1::vector
      LIMIT $2
      `,
      [embeddingLiteral, VECTOR_POOL_SIZE],
    );
  }

  // ── Structured filtering (in-memory, fast after vector pre-filter) ───────

  private applyMinYearsFilter(
    rows: VectorRow[],
    understood: UnderstoodQuery,
  ): VectorRow[] {
    const { minYears } = understood.structuredFilters;
    if (!minYears || minYears <= 0) return rows;
    return rows.filter((r) => (r.years_total ?? 0) >= minYears);
  }

  /**
   * Hard filter: candidate must have at least one of the required skills.
   * Uses substring matching so "Spring Boot" matches "spring", "Java EE" matches "java", etc.
   * Skipped when no required skills were extracted from the query.
   */
  private applyRequiredSkillsFilter(
    rows: VectorRow[],
    skillMap: Record<string, SkillRow[]>,
    understood: UnderstoodQuery,
  ): VectorRow[] {
    const required = understood.structuredFilters.requiredSkillNames;
    if (!required?.length) return rows;

    return rows.filter((row) => {
      const profileSkills = (skillMap[row.id] ?? []).map((s) => s.name.toLowerCase());
      return required.some((req) =>
        profileSkills.some((s) => s.includes(req) || req.includes(s)),
      );
    });
  }

  // ── Hydration queries ────────────────────────────────────────────────────

  private fetchSkills(profileIds: string[]): Promise<SkillRow[]> {
    if (!profileIds.length) return Promise.resolve([]);
    return this.dataSource.query<SkillRow[]>(
      `
      SELECT
        profile_id,
        name,
        CAST(years_exp AS FLOAT) AS years_exp,
        proficiency,
        is_inferred
      FROM employee_skills
      WHERE profile_id = ANY($1::uuid[])
      ORDER BY is_inferred ASC, years_exp DESC
      `,
      [profileIds],
    );
  }

  private fetchProjects(profileIds: string[]): Promise<ProjectRow[]> {
    if (!profileIds.length) return Promise.resolve([]);
    return this.dataSource.query<ProjectRow[]>(
      `
      SELECT profile_id, name, description, impact
      FROM projects
      WHERE profile_id = ANY($1::uuid[])
      ORDER BY is_current DESC, start_date DESC NULLS LAST
      `,
      [profileIds],
    );
  }

  private fetchCerts(profileIds: string[]): Promise<CertRow[]> {
    if (!profileIds.length) return Promise.resolve([]);
    return this.dataSource.query<CertRow[]>(
      `SELECT profile_id, name FROM certifications WHERE profile_id = ANY($1::uuid[])`,
      [profileIds],
    );
  }

  // ── Assemble CandidateForRanking ─────────────────────────────────────────

  private buildCandidateList(
    vectorRows: VectorRow[],
    skillRows: SkillRow[],
    projectRows: ProjectRow[],
    certRows: CertRow[],
  ): CandidateForRanking[] {
    // Group by profileId for O(1) lookups
    const skillMap  = this.groupBy(skillRows,   'profile_id');
    const projectMap = this.groupBy(projectRows, 'profile_id');
    const certMap   = this.groupBy(certRows,    'profile_id');

    return vectorRows.map((row, i) => ({
      index: i + 1,
      profileId: row.id,
      userId: row.user_id,
      name: row.name,
      title: row.title ?? 'Professional',
      yearsTotal: row.years_total ?? 0,
      skills: (skillMap[row.id] ?? []).map((s) => ({
        name: s.name,
        yearsExp: s.years_exp,
        proficiency: s.proficiency,
        isInferred: s.is_inferred,
      })),
      projectSummaries: (projectMap[row.id] ?? []).map(
        (p) => `${p.name}: ${p.description ?? ''}${p.impact ? ' — ' + p.impact : ''}`,
      ),
      certifications: (certMap[row.id] ?? []).map((c) => c.name),
      vectorScore: row.vector_score,
    }));
  }

  private groupBy<T>(rows: T[], key: keyof T): Record<string, T[]> {
    const map: Record<string, T[]> = {};
    for (const row of rows) {
      const k = String(row[key]);
      (map[k] ??= []).push(row);
    }
    return map;
  }
}
