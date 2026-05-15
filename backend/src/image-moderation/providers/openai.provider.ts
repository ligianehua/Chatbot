import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ImageModerationProvider, ImageModerationResult } from '../image-moderation.types';

/**
 * OpenAI Moderation with image input. Uses omni-moderation-latest which
 * accepts both text and base64 image_url inline.
 *
 * Required env:
 *   OPENAI_MODERATION_KEY     — API key (can reuse a regular OPENAI_API_KEY).
 *   OPENAI_MODERATION_MODEL   — optional override; defaults to
 *                               'omni-moderation-latest'.
 */
@Injectable()
export class OpenAIImageModerator implements ImageModerationProvider {
  readonly name = 'openai';
  private readonly logger = new Logger(OpenAIImageModerator.name);

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return !!this.config.get<string>('OPENAI_MODERATION_KEY');
  }

  async moderate(input: { buffer: Buffer; mime: string; filename?: string }):
      Promise<ImageModerationResult> {
    const key = this.config.get<string>('OPENAI_MODERATION_KEY');
    if (!key) {
      throw new Error('OPENAI_MODERATION_KEY not set');
    }
    const model = this.config.get<string>('OPENAI_MODERATION_MODEL', 'omni-moderation-latest');
    const dataUrl = `data:${input.mime};base64,${input.buffer.toString('base64')}`;

    const res = await fetch('https://api.openai.com/v1/moderations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        input: [{ type: 'image_url', image_url: { url: dataUrl } }],
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`openai moderation ${res.status}: ${body.slice(0, 200)}`);
    }
    const json = await res.json() as {
      results?: Array<{
        flagged?: boolean;
        categories?: Record<string, boolean>;
        category_scores?: Record<string, number>;
      }>;
    };
    const r = json.results?.[0];
    if (!r) {
      return { allowed: true, categories: [] };
    }
    const flagged = Object.entries(r.categories ?? {})
      .filter(([, v]) => v)
      .map(([k]) => k);
    return {
      allowed: !r.flagged,
      categories: flagged,
      scores: r.category_scores,
      reason: r.flagged ? `openai flagged: ${flagged.join(',')}` : undefined,
    };
  }
}
