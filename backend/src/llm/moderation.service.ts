import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Lightweight content guard for MVP. Two layers:
 *   1. inline keyword/regex check (DFA-equivalent for small lists)
 *   2. logs every rejection to ModerationLog (留痕 6 月)
 *
 * P1 should plug in 阿里云内容安全 (CN) and OpenAI Moderation (EN).
 */
@Injectable()
export class ModerationService {
  private readonly logger = new Logger(ModerationService.name);

  // Tiny seed list. Production replaces this with a managed DFA + remote API.
  private readonly banned: RegExp[] = [
    /\bkill\s+yourself\b/i,
    /\bsuicide\b/i,
    /制造炸弹|爆炸物配方/i,
  ];

  constructor(private readonly prisma: PrismaService) {}

  /**
   * @returns true if content is allowed; false if it should be blocked.
   * Side effect: logs rejections.
   */
  async check(args: { contentId: string; type: 'text' | 'image' | 'voice' | 'video'; text: string }): Promise<boolean> {
    const hit = this.banned.find((re) => re.test(args.text));
    if (!hit) return true;

    this.logger.warn(`moderation reject: ${hit.source}`);
    await this.prisma.moderationLog
      .create({
        data: {
          contentId: args.contentId,
          type: args.type,
          result: 'reject',
          reason: `pattern:${hit.source}`,
        },
      })
      .catch(() => {/* best-effort log */});
    return false;
  }
}
