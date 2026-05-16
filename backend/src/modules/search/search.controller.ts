import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { SearchService } from './search.service';
import { SearchQueryDto } from './dto/search-query.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/dto/jwt-payload.interface';
import { UserRole } from '../../common/enums';

@Controller('search')
@Roles(UserRole.HR)                   // entire controller is HR-only
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  /**
   * POST /search
   *
   * The main search endpoint. Runs the full 5-phase pipeline:
   *   query understanding → vector search → structured filter → Claude re-rank → score fusion
   *
   * Typical latency: 3–6 seconds (dominated by two Claude calls).
   * Frontend should show a progress skeleton, not a spinner — the wait is worth it.
   *
   * Body: { query: string, limit?: number }
   *
   * Response includes:
   *   - understoodAs: what the system parsed from the query (show to HR)
   *   - results[].reasoning: Claude's per-candidate explanation
   *   - results[].scores: { vector, claude, final }
   *   - results[].strengths / gaps: bullet-point evidence
   *   - locationNote: if location was mentioned but can't be filtered
   */
  @Post()
  @HttpCode(HttpStatus.OK)
  search(
    @Body() dto: SearchQueryDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.searchService.search(dto, user.sub);
  }

  /**
   * GET /search/history
   * Returns the last 20 queries this HR user has run.
   * Powers the "recent searches" panel in the HR dashboard.
   */
  @Get('history')
  getHistory(
    @CurrentUser() user: JwtPayload,
    @Query('limit') limit = 20,
  ) {
    return this.searchService.getHistory(user.sub, +limit);
  }

  /**
   * GET /search/:id
   * Full detail for a past search — results, scores, reasoning.
   * Used by the "revisit search" feature.
   */
  @Get(':id')
  getSearchDetail(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.searchService.getSearchDetail(id, user.sub);
  }
}
