import { ElasticsearchService } from '../src/search/elasticsearch.service';
import { MailService } from '../src/mail/mail.service';
import { EmbeddingService } from '../src/ai/embedding.service';

const noopConfig: any = { get: () => undefined };
const noopEmbedding: any = { embed: jest.fn(async () => null), enabled: false };

describe('Integration services (degrade gracefully without external services)', () => {
  it('ElasticsearchService is disabled and safe when ELASTICSEARCH_URL is unset', async () => {
    const es = new ElasticsearchService(noopConfig, noopEmbedding);
    expect(es.enabled).toBe(false);
    await expect(es.indexMessage({} as any)).resolves.toBeUndefined();
    const res = await es.searchIds('u1', 'hello', undefined, 1, 20);
    expect(res).toEqual({ ids: [], total: 0 });
  });

  it('MailService runs in demo mode (no send) when SMTP_HOST is unset', async () => {
    const mail = new MailService(noopConfig);
    expect(mail.enabled).toBe(false);
    const result = await mail.send(['x@y.com'], 'Hi', '<p>hello</p>');
    expect(result.sent).toBe(false);
    expect(result.error).toBe('SMTP_NOT_CONFIGURED');
  });

  it('EmbeddingService returns null when no API key is configured', async () => {
    const emb = new EmbeddingService(noopConfig);
    expect(emb.enabled).toBe(false);
    expect(await emb.embed('anything')).toBeNull();
  });
});
