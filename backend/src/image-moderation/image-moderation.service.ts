import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { ImageModerationProvider, ImageModerationResult } from './image-moderation.types';
import { MockImageModerator } from './providers/mock.provider';
import { OpenAIImageModerator } from './providers/openai.provider';

@Injectable()
export class ImageModerationService {
  private readonly logger = new Logger(ImageModerationService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly mock: MockImageModerator,
    private readonly openai: OpenAIImageModerator,
  ) {}

  /**
   * Provider selection:
   *   - IMAGE_MODERATION_MODE=mock   → MockImageModerator (CI / no-key dev)
   *   - IMAGE_MODERATION_MODE=openai → OpenAIImageModerator
   *   - unset:
   *       NODE_ENV=production → reject all (fail closed; force config)
   *       otherwise           → MockImageModerator
   */
  private pickProvider(): ImageModerationProvider | null {
    const mode = this.config.get<string>('IMAGE_MODERATION_MODE', '').trim();
    if (mode === 'mock') return this.mock;
    if (mode === 'openai') return this.openai;
    if (this.config.get<string>('NODE_ENV') === 'production') return null;
    return this.mock;
  }

  async check(args: { buffer: Buffer; mime: string; filename?: string; contentId: string }):
      Promise<ImageModerationResult> {
    const provider = this.pickProvider();
    if (!provider) {
      // Fail closed: production without explicit configuration rejects every
      // upload rather than silently letting things through.
      const result: ImageModerationResult = {
        allowed: false,
        categories: ['unconfigured'],
        reason: 'IMAGE_MODERATION_MODE not configured',
      };
      await this.persistLog(args.contentId, result);
      return result;
    }

    let result: ImageModerationResult;
    try {
      result = await provider.moderate({
        buffer: args.buffer,
        mime: args.mime,
        filename: args.filename,
      });
    } catch (e) {
      this.logger.warn(`provider ${provider.name} threw: ${e instanceof Error ? e.message : e}`);
      // Fail closed on provider errors in production; allow in dev/test so
      // local work isn't blocked by transient upstream issues.
      const failClosed = this.config.get<string>('NODE_ENV') === 'production';
      result = {
        allowed: !failClosed,
        categories: failClosed ? ['provider-error'] : [],
        reason: e instanceof Error ? e.message : String(e),
      };
    }

    await this.persistLog(args.contentId, result);
    return result;
  }

  private async persistLog(contentId: string, result: ImageModerationResult): Promise<void> {
    await this.prisma.moderationLog
      .create({
        data: {
          contentId,
          type: 'image',
          result: result.allowed ? 'pass' : 'reject',
          reason: result.allowed
            ? (result.categories.length ? `flagged:${result.categories.join(',')}` : null)
            : (result.categories.join(',') || result.reason || 'rejected'),
        },
      })
      .catch((e) => this.logger.warn(`moderation log failed: ${e}`));
  }
}
