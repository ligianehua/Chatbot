/**
 * Minimal pluggable LLM gateway. Today supports two providers:
 *   - DeepSeekProvider (real, OpenAI-compatible endpoint)
 *   - MockProvider     (echo-style stream for tests / no-key dev)
 *
 * The chat path is a stream of plain-text chunks. Token accounting is the
 * caller's responsibility (we return final usage via the closing fields when
 * the upstream provides them).
 */
export interface LlmChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LlmChunk {
  delta: string;
}

export interface LlmStreamResult {
  fullText: string;
  inputTokens: number;
  outputTokens: number;
  model: string;
}

export interface LlmProvider {
  readonly name: string;
  streamChat(opts: {
    model: string;
    temperature: number;
    messages: LlmChatMessage[];
    onChunk: (chunk: LlmChunk) => void;
    signal?: AbortSignal;
  }): Promise<LlmStreamResult>;
}
