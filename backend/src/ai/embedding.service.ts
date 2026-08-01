import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Embedding provider. Uses z.ai (Zhipu AI) OpenAI-compatible embeddings when
 * ZAI_API_KEY is set. Returns null when embeddings are disabled so callers fall
 * back to keyword search. Swap the implementation here for another provider.
 */
@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger('Embedding');
  private readonly model: string;
  private readonly baseUrl: string;
  private readonly key?: string;
  readonly enabled: boolean;

  constructor(config: ConfigService) {
    this.key = config.get<string>('ZAI_API_KEY') ?? config.get<string>('OPENAI_API_KEY');
    this.baseUrl = config.get<string>('EMBEDDING_URL') ?? 'https://api.z.ai/v1/embeddings';
    this.model = config.get<string>('EMBEDDING_MODEL') ?? 'embedding-3';
    this.enabled = Boolean(this.key);
  }

  async embed(text: string): Promise<number[] | null> {
    if (!this.enabled || !this.key) return null;
    try {
      const res = await fetch(this.baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.key}` },
        body: JSON.stringify({ input: text.slice(0, 8000), model: this.model }),
      });
      if (!res.ok) {
        this.logger.warn(`embedding failed (${res.status})`);
        return null;
      }
      const json = (await res.json()) as { data?: { embedding?: number[] }[] };
      return json?.data?.[0]?.embedding ?? null;
    } catch (e) {
      this.logger.warn(`embedding error: ${(e as Error).message}`);
      return null;
    }
  }
}
