import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { VectorSearcherService } from './services/vector-searcher.service';
import { CandidateRankerService } from './services/candidate-ranker.service';
import { SearchPersisterService } from './services/search-persister.service';
import { SearchQuery } from './entities/search-query.entity';
import { SearchResult } from './entities/search-result.entity';
import { AiModule } from '../ai/ai.module';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([SearchQuery, SearchResult, User]),
    AiModule,
  ],
  controllers: [SearchController],
  providers: [
    SearchService,
    VectorSearcherService,
    CandidateRankerService,
    SearchPersisterService,
  ],
  exports: [SearchService],
})
export class SearchModule {}
