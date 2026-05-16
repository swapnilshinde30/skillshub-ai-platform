import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SearchQuery } from '../entities/search-query.entity';
import { SearchResult } from '../entities/search-result.entity';
import { SearchResultItem, UnderstoodQuery } from '../types/search.types';
import { SearchRecommendation } from '../../../common/enums';

@Injectable()
export class SearchPersisterService {
  constructor(
    @InjectRepository(SearchQuery)
    private readonly queryRepo: Repository<SearchQuery>,
    @InjectRepository(SearchResult)
    private readonly resultRepo: Repository<SearchResult>,
  ) {}

  /**
   * Saves the query metadata + all ranked results in one shot.
   * Returns the saved SearchQuery id for the response.
   */
  async persistSearch(
    hrUserId: string,
    queryText: string,
    queryEmbedding: number[],
    understood: UnderstoodQuery,
    results: SearchResultItem[],
    executionTimeMs: number,
  ): Promise<string> {
    const saved = await this.queryRepo.save(
      this.queryRepo.create({
        hrUserId,
        queryText,
        queryEmbedding,
        filters: {
          requiredSkills:  understood.requiredSkills,
          preferredSkills: understood.preferredSkills,
          minYears:        understood.minYearsExperience,
          seniorityLevel:  understood.seniorityLevel,
          domain:          understood.domain,
          location:        understood.location,
        },
        resultCount:     results.length,
        executionTimeMs,
      }),
    );

    if (results.length) {
      const resultEntities = results.map((r, i) =>
        this.resultRepo.create({
          queryId:        saved.id,
          profileId:      r.profile.id,
          rankPosition:   i + 1,
          vectorScore:    r.scores.vector,
          claudeScore:    r.scores.claude,
          finalScore:     r.scores.final,
          reasoning:      r.reasoning,
          strengths:      r.strengths,
          gaps:           r.gaps,
          recommendation: r.recommendation as SearchRecommendation,
        }),
      );
      await this.resultRepo.save(resultEntities);
    }

    return saved.id;
  }

  /** Returns the last N queries for an HR user (for the search history page). */
  async getHistory(
    hrUserId: string,
    limit = 20,
  ): Promise<SearchQuery[]> {
    return this.queryRepo.find({
      where:  { hrUserId },
      order:  { createdAt: 'DESC' },
      take:   limit,
    });
  }

  /** Full result set for a past query (replay/detail view). */
  async getSearchDetail(searchId: string, hrUserId: string): Promise<SearchQuery | null> {
    return this.queryRepo.findOne({
      where:     { id: searchId, hrUserId },
      relations: ['results', 'results.profile', 'results.profile.user'],
    });
  }
}
