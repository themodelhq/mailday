import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from '@elastic/elasticsearch';
import { Message } from '@prisma/client';
import { EmbeddingService } from '../ai/embedding.service';

const INDEX = 'mailday_messages';

export interface EsSearchResult {
  ids: string[];
  total: number;
}

/**
 * Elasticsearch indexer + search. Activates only when ELASTICSEARCH_URL is set.
 * Supports keyword (multi_match) and, when embeddings are enabled, hybrid
 * semantic (kNN) search. Degrades to a no-op when ES is unavailable so the
 * app keeps working on Prisma-only search.
 */
@Injectable()
export class ElasticsearchService implements OnModuleInit {
  private readonly logger = new Logger('Elasticsearch');
  private client: Client | null = null;
  enabled = false;
  private dims = 1536;

  constructor(
    private readonly config: ConfigService,
    private readonly embedding: EmbeddingService,
  ) {
    const url = this.config.get<string>('ELASTICSEARCH_URL');
    const dims = this.config.get<string>('EMBEDDING_DIMS');
    if (url) {
      this.enabled = true;
      this.dims = dims ? parseInt(dims, 10) : 2048;
      this.client = new Client({ node: url });
    }
  }

  async onModuleInit() {
    if (!this.enabled || !this.client) return;
    try {
      const exists = (await this.client.indices.exists({ index: INDEX })) as unknown as boolean;
      if (!exists) {
        await this.client.indices.create({
          index: INDEX,
          mappings: {
            properties: {
              ownerId: { type: 'keyword' },
              mailbox: { type: 'keyword' },
              from: { type: 'keyword' },
              to: { type: 'keyword' },
              subject: { type: 'text' },
              body: { type: 'text' },
              snippet: { type: 'text' },
              labels: { type: 'keyword' },
              sentAt: { type: 'date' },
              embedding: { type: 'dense_vector', dims: this.dims },
            },
          },
        });
        this.logger.log(`Created ES index "${INDEX}"`);
      }
    } catch (e) {
      this.logger.error(`ES init failed, disabling search: ${(e as Error).message}`);
      this.enabled = false;
    }
  }

  private async embed(text: string): Promise<number[] | null> {
    if (!this.config.get('EMBEDDINGS_ENABLED')) return null;
    return this.embedding.embed(text);
  }

  async indexMessage(m: Message) {
    if (!this.enabled || !this.client) return;
    try {
      const embedding = await this.embed(`${m.subject}\n${m.body}`);
      await this.client.index({
        index: INDEX,
        id: m.id,
        document: this.toDoc(m, embedding),
      });
    } catch (e) {
      this.logger.warn(`index failed: ${(e as Error).message}`);
    }
  }

  async updateMessage(m: Message) {
    if (!this.enabled || !this.client) return;
    try {
      const embedding = await this.embed(`${m.subject}\n${m.body}`);
      await this.client.update({
        index: INDEX,
        id: m.id,
        doc: this.toDoc(m, embedding),
        doc_as_upsert: true,
      });
    } catch (e) {
      this.logger.warn(`update failed: ${(e as Error).message}`);
    }
  }

  async removeMessage(id: string) {
    if (!this.enabled || !this.client) return;
    try {
      await this.client.delete({ index: INDEX, id });
    } catch {
      /* already gone */
    }
  }

  private toDoc(m: Message, embedding: number[] | null) {
    return {
      ownerId: m.ownerId,
      mailbox: m.mailbox,
      from: m.from,
      to: m.to,
      subject: m.subject,
      body: m.body,
      snippet: m.snippet,
      labels: m.labels,
      sentAt: m.sentAt,
      embedding,
    };
  }

  async searchIds(
    ownerId: string,
    query: string,
    mailbox: string | undefined,
    page: number,
    limit: number,
  ): Promise<EsSearchResult> {
    if (!this.enabled || !this.client) return { ids: [], total: 0 };

    const must: Record<string, unknown>[] = [{ term: { ownerId } }];
    if (mailbox) must.push({ term: { mailbox } });

    const queryEmbedding = await this.embed(query);
    const body: Record<string, unknown> = {
      query: {
        bool: {
          must,
          should: [
            {
              multi_match: {
                query,
                fields: ['subject^2', 'body', 'from', 'snippet'],
                type: 'most_fields',
              },
            },
          ],
          minimum_should_match: 0,
        },
      },
      from: (page - 1) * limit,
      size: limit,
      sort: [{ _score: 'desc' }, { sentAt: { order: 'desc' } }],
    };

    if (queryEmbedding) {
      body.knn = {
        field: 'embedding',
        query_vector: queryEmbedding,
        k: limit,
        num_candidates: limit * 10,
      };
    }

    try {
      const res = await this.client.search({ index: INDEX, ...(body as object) } as object);
      const hits = (res as any).hits?.hits ?? [];
      const total = (res as any).hits?.total?.value ?? hits.length;
      return { ids: hits.map((h: any) => h._id as string), total };
    } catch (e) {
      this.logger.warn(`search failed: ${(e as Error).message}`);
      return { ids: [], total: 0 };
    }
  }
}
