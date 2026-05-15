import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { LlmChatMessage, LlmProvider, LlmStreamResult } from './llm.types';
import { DeepSeekProvider } from './providers/deepseek.provider';
import { MockProvider } from './providers/mock.provider';

const MAX_CONTEXT_TURNS = 20;

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly deepseek: DeepSeekProvider,
    private readonly mock: MockProvider,
  ) {}

  private pickProvider(): LlmProvider {
    if (this.deepseek.isConfigured()) return this.deepseek;
    this.logger.warn('LLM_API_KEY missing — using MockProvider');
    return this.mock;
  }

  /**
   * Builds the chat message array from the latest persisted messages + the
   * bot's system prompt, then streams the assistant reply.
   *
   * On success, writes one row to llm_usage_logs for billing/analytics.
   */
  async streamForBot(args: {
    botId: string;
    userId: string;
    conversationId: string;
    onChunk: (delta: string) => void;
    signal?: AbortSignal;
  }): Promise<LlmStreamResult> {
    const bot = await this.prisma.bot.findUnique({ where: { id: args.botId } });
    if (!bot) throw new Error('bot not found');

    const recent = await this.prisma.message.findMany({
      where: { conversationId: args.conversationId },
      orderBy: { id: 'desc' },
      take: MAX_CONTEXT_TURNS,
    });

    const messages: LlmChatMessage[] = [
      { role: 'system', content: bot.systemPrompt },
      ...recent
        .reverse()
        .filter((m) => m.type === 'text')
        .map((m) => ({
          role: m.senderId ? ('user' as const) : ('assistant' as const),
          content: (m.content as { text?: string })?.text ?? '',
        })),
    ];

    const provider = this.pickProvider();
    const result = await provider.streamChat({
      model: bot.model,
      temperature: bot.temperature,
      messages,
      onChunk: ({ delta }) => args.onChunk(delta),
      signal: args.signal,
    });

    await this.prisma.llmUsageLog
      .create({
        data: {
          botId: bot.id,
          userId: args.userId,
          model: result.model,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          // crude cost — provider-specific pricing belongs in a separate service.
          costCents: Math.ceil((result.inputTokens + result.outputTokens) / 1000),
        },
      })
      .catch((e) => this.logger.warn(`usage log failed: ${e}`));

    return result;
  }
}
