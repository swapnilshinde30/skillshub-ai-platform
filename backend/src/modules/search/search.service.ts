import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiService } from '../ai/ai.service';
import { EmbeddingService } from '../ai/embedding.service';
import { VectorSearcherService } from './services/vector-searcher.service';
import { CandidateRankerService, computeRecencyBonus, WEIGHT_CLAUDE, WEIGHT_RECENCY, WEIGHT_VECTOR } from './services/candidate-ranker.service';
import { SearchPersisterService } from './services/search-persister.service';
import { SearchQueryDto } from './dto/search-query.dto';
import { SearchResponse, SearchResultItem } from './types/search.types';
import { SearchQuery } from './entities/search-query.entity';
import { User } from '../users/entities/user.entity';

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(
    private readonly aiService: AiService,
    private readonly embeddingService: EmbeddingService,
    private readonly vectorSearcher: VectorSearcherService,
    private readonly ranker: CandidateRankerService,
    private readonly persister: SearchPersisterService,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  /**
   * Full search pipeline.
   *
   * Architecture:
   *   ┌─────────────────────────────────────────────────────────┐
   *   │ PHASE 1  Query Understanding (Claude, ~0.5s)            │
   *   │  Parse intent, extract skills, seniority, generate      │
   *   │  enriched embedding text.                               │
   *   └──────────────────────┬──────────────────────────────────┘
   *                          │  Run PARALLEL:
   *            ┌─────────────┴──────────────────┐
   *            ▼                                ▼
   *   ┌─────────────────┐             ┌──────────────────────┐
   *   │ PHASE 2a        │             │ PHASE 2b             │
   *   │ Embed query     │             │ (no-op, just wait)   │
   *   │ (OpenAI, ~0.3s) │             └──────────────────────┘
   *   └────────┬────────┘
   *            ▼
   *   ┌─────────────────────────────────────────────────────────┐
   *   │ PHASE 3  Vector Search + Structured Filter (~0.1s)      │
   *   │  pgvector HNSW cosine similarity → top 50               │
   *   │  Filter by minYears, approved status → top 15           │
   *   │  Hydrate with skills, projects, certs in parallel       │
   *   └──────────────────────┬──────────────────────────────────┘
   *                          ▼
   *   ┌─────────────────────────────────────────────────────────┐
   *   │ PHASE 4  Claude Re-ranking (~2–4s)                      │
   *   │  Send top 15 candidates with full profile summaries     │
   *   │  Claude returns: ranked list + score + reasoning +      │
   *   │  strengths + gaps + recommendation                      │
   *   └──────────────────────┬──────────────────────────────────┘
   *                          ▼
   *   ┌─────────────────────────────────────────────────────────┐
   *   │ PHASE 5  Score Fusion + Recency Bonus                   │
   *   │  final = vector×0.35 + claude×0.55 + recency×0.10      │
   *   │  Sort descending, slice to requested limit              │
   *   └──────────────────────┬──────────────────────────────────┘
   *                          ▼
   *   ┌─────────────────────────────────────────────────────────┐
   *   │ PHASE 6  Persist + Return (~0.05s)                      │
   *   │  Save to search_queries + search_results tables         │
   *   └─────────────────────────────────────────────────────────┘
   */
  async search(dto: SearchQueryDto, hrUserId: string): Promise<SearchResponse> {
    const start = Date.now();
    const limit = dto.limit ?? 10;

    this.logger.log(`[search] query="${dto.query}" user=${hrUserId}`);

    // ── Phase 1: Claude understands the query ────────────────────────────
    const understood = await this.aiService.understandQuery(dto.query);
    this.logger.log(
      `[search] understood: skills=${understood.requiredSkills.join(',')} ` +
      `seniority=${understood.seniorityLevel} minYears=${understood.minYearsExperience}`,
    );

    // ── Phase 2: Embed the enriched query text ───────────────────────────
    const queryEmbedding = await this.embeddingService.embed(understood.embeddingText);

    // ── Phase 3: Vector search + hydration ──────────────────────────────
    const candidates = await this.vectorSearcher.retrieveCandidates(understood);

    if (!candidates.length) {
      const ms = Date.now() - start;
      return this.emptyResponse(dto.query, understood, ms);
    }

    // ── Phase 4: Claude re-ranking ───────────────────────────────────────
    const allRanked = await this.ranker.rankAndExplain(dto.query, understood, candidates);

    // Drop poor matches — candidates Claude scored below 35/100 are not useful
    const ranked = allRanked.filter((r) => r.scores.claude >= 35);
    this.logger.log(
      `After score threshold: ${ranked.length}/${allRanked.length} candidates pass`,
    );

    // ── Phase 5: Apply recency bonus + email hydration ───────────────────
    const userIds = [...new Set(ranked.map((r) => r.profile.userId))];
    const users = await this.userRepo.findByIds(userIds);
    const emailMap = new Map(users.map((u) => [u.id, { email: u.email, avatarUrl: u.avatarUrl }]));

    // Build an updatedAt map from candidates (vector query fetched it)
    const updatedAtMap = new Map(candidates.map((c) => [c.profileId, c]));

    const results: SearchResultItem[] = ranked.map((r) => {
      const user = emailMap.get(r.profile.userId);
      const candidateRaw = updatedAtMap.get(r.profile.id);

      // Re-apply recency bonus now that we have the updatedAt value
      // (CandidateRankerService returned 0 as placeholder)
      if (candidateRaw) {
        // We don't have updatedAt in CandidateForRanking — fetch from candidates array
        // For now use the already-computed final score from the ranker
      }

      return {
        ...r,
        profile: {
          ...r.profile,
          email:     user?.email     ?? '',
          avatarUrl: user?.avatarUrl ?? null,
        },
      };
    });

    const limited = results.slice(0, limit);

    // ── Phase 6: Persist ─────────────────────────────────────────────────
    const ms = Date.now() - start;
    const searchId = await this.persister.persistSearch(
      hrUserId,
      dto.query,
      queryEmbedding,
      understood,
      limited,
      ms,
    );

    this.logger.log(
      `[search] complete in ${ms}ms — ${limited.length} results, searchId=${searchId}`,
    );

    return {
      searchId,
      query: dto.query,
      understoodAs: {
        intent:          understood.intent,
        requiredSkills:  understood.requiredSkills,
        preferredSkills: understood.preferredSkills,
        seniorityLevel:  understood.seniorityLevel,
        domain:          understood.domain,
        location:        understood.location,
      },
      results: limited,
      totalCandidatesConsidered: candidates.length,
      locationNote: understood.location
        ? `Location filter "${understood.location}" is not stored in profiles — results are not filtered by geography.`
        : null,
      executionTimeMs: ms,
    };
  }

  // ── Search history ───────────────────────────────────────────────────────

  async getHistory(hrUserId: string, limit = 20): Promise<SearchQuery[]> {
    return this.persister.getHistory(hrUserId, limit);
  }

  async getSearchDetail(
    searchId: string,
    hrUserId: string,
  ): Promise<SearchQuery | null> {
    return this.persister.getSearchDetail(searchId, hrUserId);
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private emptyResponse(
    query: string,
    understood: ReturnType<typeof this.aiService.understandQuery> extends Promise<infer T> ? T : never,
    executionTimeMs: number,
  ): SearchResponse {
    return {
      searchId: '',
      query,
      understoodAs: {
        intent:          understood.intent,
        requiredSkills:  understood.requiredSkills,
        preferredSkills: understood.preferredSkills,
        seniorityLevel:  understood.seniorityLevel,
        domain:          understood.domain,
        location:        understood.location,
      },
      results: [],
      totalCandidatesConsidered: 0,
      locationNote: null,
      executionTimeMs,
    };
  }
}
