import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type AiMode = 'draft' | 'reply' | 'summarize' | 'rewrite';
export type AiTone = 'professional' | 'friendly' | 'short' | 'expand';

interface ChatMessage {
  role: 'system' | 'user';
  content: string;
}

/**
 * AI text generation via a z.ai (Zhipu AI) OpenAI-compatible Chat Completions API.
 * Disabled (enabled=false) when ZAI_API_KEY is unset, so callers can gracefully
 * report "AI not configured". Swap base URL/model for another compatible provider.
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger('AI');
  readonly enabled: boolean;
  private readonly model: string;
  private readonly baseUrl: string;
  private readonly key?: string;

  constructor(config: ConfigService) {
    this.key = config.get<string>('ZAI_API_KEY') ?? config.get<string>('OPENAI_API_KEY');
    this.baseUrl =
      config.get<string>('ZAI_BASE_URL') ?? 'https://api.z.ai/v1/chat/completions';
    this.model = config.get<string>('ZAI_MODEL') ?? 'glm-4-flash';
    this.enabled = Boolean(this.key);
  }

  private buildMessages(mode: AiMode, input: string, subject?: string, tone?: AiTone): ChatMessage[] {
    const systemByMode: Record<AiMode, string> = {
      draft: 'You are an email writing assistant. Produce a concise, professional email body. Return only the email text, no preamble.',
      reply: 'You are an email reply assistant. Write a polite, context-aware reply to the provided thread. Return only the reply text.',
      summarize:
        'You are an email summarization assistant. Summarize the thread into 3-5 bullet points of key facts and action items. Use markdown bullet points only.',
      rewrite:
        'You are an editing assistant. Rewrite the text to be clear and professional. Return only the rewritten text.',
    };

    let user = '';
    if (mode === 'reply') user = `Thread:\n${input}`;
    else if (mode === 'summarize') user = input;
    else user = `Subject: ${subject ?? '(no subject)'}\n\n${input}`;

    if (tone === 'professional') user += '\n\nTone: professional and formal.';
    else if (tone === 'friendly') user += '\n\nTone: friendly and warm.';
    else if (tone === 'short') user += '\n\nMake it as short as possible.';
    else if (tone === 'expand') user += '\n\nExpand with helpful, relevant detail.';

    return [
      { role: 'system', content: systemByMode[mode] },
      { role: 'user', content: user },
    ];
  }

  async generate(
    mode: AiMode,
    input: string,
    opts: { subject?: string; tone?: AiTone } = {},
  ): Promise<string> {
    if (!this.enabled || !this.key) throw new Error('AI_NOT_CONFIGURED');

    try {
      const res = await fetch(this.baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.key}` },
        body: JSON.stringify({
          model: this.model,
          messages: this.buildMessages(mode, input, opts.subject, opts.tone),
          temperature: 0.7,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        this.logger.warn(`AI request failed (${res.status}): ${text.slice(0, 200)}`);
        throw new Error('AI_REQUEST_FAILED');
      }
      const json = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      return json?.choices?.[0]?.message?.content?.trim() ?? '';
    } catch (e) {
      this.logger.error(`AI error: ${(e as Error).message}`);
      throw e;
    }
  }
}
