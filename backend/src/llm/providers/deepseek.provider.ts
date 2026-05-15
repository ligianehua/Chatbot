import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LlmChatMessage, LlmChunk, LlmProvider, LlmStreamResult } from '../llm.types';

/**
 * DeepSeek uses an OpenAI-compatible /v1/chat/completions endpoint with
 * server-sent events. We parse the SSE lines and forward content deltas.
 *
 * Set LLM_API_KEY and (optionally) LLM_BASE_URL in .env to enable.
 */
@Injectable()
export class DeepSeekProvider implements LlmProvider {
  readonly name = 'deepseek';
  private readonly logger = new Logger(DeepSeekProvider.name);

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return !!this.config.get<string>('LLM_API_KEY');
  }

  async streamChat(opts: {
    model: string;
    temperature: number;
    messages: LlmChatMessage[];
    onChunk: (c: LlmChunk) => void;
    signal?: AbortSignal;
  }): Promise<LlmStreamResult> {
    const apiKey = this.config.get<string>('LLM_API_KEY');
    const baseUrl = this.config.get<string>('LLM_BASE_URL', 'https://api.deepseek.com');
    if (!apiKey) throw new Error('LLM_API_KEY not configured');

    const res = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: opts.model,
        temperature: opts.temperature,
        messages: opts.messages,
        stream: true,
      }),
      signal: opts.signal,
    });

    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => '');
      throw new Error(`upstream ${res.status}: ${text.slice(0, 200)}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    let fullText = '';
    let inputTokens = 0;
    let outputTokens = 0;

    while (true) {
      if (opts.signal?.aborted) {
        try { reader.cancel(); } catch {/* noop */}
        break;
      }
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });

      let lineEnd: number;
      while ((lineEnd = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, lineEnd).trim();
        buf = buf.slice(lineEnd + 1);
        if (!line || !line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (data === '[DONE]') continue;
        try {
          const json = JSON.parse(data);
          const delta = json?.choices?.[0]?.delta?.content;
          if (typeof delta === 'string' && delta.length > 0) {
            fullText += delta;
            opts.onChunk({ delta });
          }
          if (json?.usage) {
            inputTokens = json.usage.prompt_tokens ?? inputTokens;
            outputTokens = json.usage.completion_tokens ?? outputTokens;
          }
        } catch (e) {
          this.logger.warn(`bad SSE line: ${data.slice(0, 80)}`);
        }
      }
    }

    return { fullText, inputTokens, outputTokens, model: opts.model };
  }
}
