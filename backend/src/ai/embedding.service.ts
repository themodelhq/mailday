import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger('Embedding');
  private readonly model: string;
  private readonly baseUrl: string;
  private readonly key?: string;
  readonly enabled: boolean;
  private readonly timeoutMs = 15000;

  constructor(config: ConfigService) {
    this.key = config.get<string>('ZAI_API_KEY') ?? config.get<string>('OPENAI_API_KEY');
    this.baseUrl = config.get<string>('EMBEDDING_URL') ?? 'https://api.z.ai/v1/embeddings';
    this.model = config.get<string>('EMBEDDING_MODEL') ?? 'embedding-3';
    this.enabled = Boolean(this.key);
  }

  async embed(text: string): Promise<number[] | null> {
    if (!this.enabled || !this.key || typeof text !== 'string' || !text.trim()) return null;
    try {
      const res = await fetch(this.baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.key}` },
        body: JSON.stringify({ input: text.slice(0, 8000), model: this.model }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      if (!res.ok) {
        this.logger.warn(`embedding provider failed with HTTP ${res.status}`);
        return null;
      }
      const json = await res.json() as { data?: { embedding?: unknown }[] };
      const embedding = json?.data?.[0]?.embedding;
      if (!Array.isArray(embedding) || embedding.length === 0 || !embedding.every(v => typeof v === 'number' && Number.isFinite(v))) {
        this.logger.warn('embedding provider returned an invalid vector');
        return null;
      }
      return embedding as number[];
    } catch (e) {
      this.logger.warn(`embedding provider request failed (${(e as Error).name || 'unknown error'})`);
      return null;
    }
  }
}
