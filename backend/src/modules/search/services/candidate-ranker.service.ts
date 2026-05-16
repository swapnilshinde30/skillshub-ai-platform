import { Injectable, Logger } from '@nestjs/common';
import {
  CandidateForRanking,
  ClaudeRankedEntry,
  SearchResultItem,
  UnderstoodQuery,
} from '../types/search.types';
import { AiService } from '../../ai/ai.service';
import { SearchRecommendation } from '../../../common/enums';

/**
 * Score fusion weights.
 *
 * Why 0.55 Claude weight?
 *   Vector search finds semantically similar profiles but cannot understand
 *   constraints like "senior" (5+ years) or "payment gateway experience".
 *   Claude reads every candidate holistically and its score is the primary signal.
 *
 * Why keep 0.35 vector weight?
 *   Breaks ties between candidates with the same Claude score.
 *   Also ensures the overall ranking is stable — two Claude calls for the same
 *   query might order edge-case candidates slightly differently; the vector score
 *   provides a deterministic tiebreaker.
 *
 * Why 0.10 recency?
 *   Profiles updated in the last 6 months are more likely to be current.
 *   Small enough that it never overrides skill quality, but surfaces recently
 *   active employees in the demo.
 */
const WEIGHT_VECTOR  = 0.35;
const WEIGHT_CLAUDE  = 0.55;
const WEIGHT_RECENCY = 0.10;

const SIX_MONTHS_MS = 6 * 30 * 24 * 60 * 60 * 1000;

@Injectable()
export class CandidateRankerService {
  private readonly logger = new Logger(CandidateRankerService.name);

  constructor(private readonly aiService: AiService) {}

  async rankAndExplain(
    originalQuery: string,
    understood: UnderstoodQuery,
    candidates: CandidateForRanking[],
  ): Promise<SearchResultItem[]> {
    if (!candidates.length) return [];

    // Claude re-ranks and adds per-candidate reasoning
    const claudeRanked = await this.aiService.rankCandidates(
      originalQuery,
      understood,
      candidates,
    );

    this.logger.log(
      `Claude ranked ${claudeRanked.length}/${candidates.length} candidates`,
    );

    // Map Claude results back to candidate data using the 1-based index
    const candidateByIndex = new Map(candidates.map((c) => [c.index, c]));

    const results: SearchResultItem[] = [];

    for (const ranked of claudeRanked) {
      const candidate = candidateByIndex.get(ranked.candidateIndex);
      if (!candidate) continue;

      const vectorScore  = candidate.vectorScore;
      const claudeScore  = ranked.score / 100;
      const recencyScore = this.recencyBonus(candidate);
      const finalScore   =
        vectorScore  * WEIGHT_VECTOR +
        claudeScore  * WEIGHT_CLAUDE +
        recencyScore * WEIGHT_RECENCY;

      results.push({
        profile: {
          id:             candidate.profileId,
          userId:         candidate.userId,
          name:           candidate.name,
          email:          '',           // populated by search.service after DB lookup
          title:          candidate.title,
          yearsTotal:     candidate.yearsTotal,
          skills:         candidate.skills,
          topProjects:    candidate.projectSummaries.slice(0, 3),
          certifications: candidate.certifications,
          avatarUrl:      null,
        },
        scores: {
          vector: Math.round(vectorScore * 10000) / 10000,
          claude: ranked.score,
          final:  Math.round(finalScore  * 10000) / 10000,
        },
        reasoning:      ranked.reasoning,
        strengths:      ranked.strengths,
        gaps:           ranked.gaps,
        recommendation: ranked.recommendation,
      });
    }

    // Final sort by composite score — Claude's ordering is close but finalScore
    // can shift position slightly when vector score differs significantly
    return results.sort((a, b) => b.scores.final - a.scores.final);
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private recencyBonus(_candidate: CandidateForRanking): number {
    // CandidateForRanking doesn't carry updatedAt — search.service applies
    // this after hydration. Return 0 here; overridden in service.
    return 0;
  }
}

/**
 * Standalone recency scorer used by SearchService.
 * Returns 0 or 1 (scaled by WEIGHT_RECENCY in the caller).
 */
export function computeRecencyBonus(updatedAt: Date | string | null): number {
  if (!updatedAt) return 0;
  const age = Date.now() - new Date(updatedAt).getTime();
  return age < SIX_MONTHS_MS ? 1 : 0;
}

export { WEIGHT_VECTOR, WEIGHT_CLAUDE, WEIGHT_RECENCY };
