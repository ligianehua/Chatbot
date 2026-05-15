import { Injectable } from '@nestjs/common';
import { LlmChunk, LlmProvider, LlmStreamResult, LlmChatMessage } from '../llm.types';

/**
 * Used when no real API key is configured. Generates a deterministic echo so
 * end-to-end tests can validate the entire chat path without a network call.
 */
@Injectable()
export class MockProvider implements LlmProvider {
  readonly name = 'mock';

  async streamChat(opts: {
    model: string;
    temperature: number;
    messages: LlmChatMessage[];
    onChunk: (c: LlmChunk) => void;
    signal?: AbortSignal;
  }): Promise<LlmStreamResult> {
    const lastUser = [...opts.messages].reverse().find((m) => m.role === 'user');
    const reply = lastUser
      ? `[mock] 我收到："${lastUser.content.slice(0, 80)}"。请配置 LLM_API_KEY 启用真实模型。`
      : '[mock] 你好。请配置 LLM_API_KEY 启用真实模型。';

    let full = '';
    for (const ch of reply) {
      if (opts.signal?.aborted) break;
      opts.onChunk({ delta: ch });
      full += ch;
      await new Promise((r) => setTimeout(r, 5));
    }
    return {
      fullText: full,
      inputTokens: opts.messages.reduce((s, m) => s + m.content.length, 0) / 4 | 0,
      outputTokens: full.length / 4 | 0,
      model: opts.model,
    };
  }
}
