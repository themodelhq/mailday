import { Global, Module } from '@nestjs/common';
import { ElasticsearchService } from './elasticsearch.service';
import { EmbeddingService } from '../ai/embedding.service';

@Global()
@Module({
  providers: [ElasticsearchService, EmbeddingService],
  exports: [ElasticsearchService, EmbeddingService],
})
export class SearchModule {}
