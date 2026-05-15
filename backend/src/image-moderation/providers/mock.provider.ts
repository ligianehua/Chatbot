import { Injectable } from '@nestjs/common';
import { ImageModerationProvider, ImageModerationResult } from '../image-moderation.types';

/**
 * Deterministic mock used in dev / CI. Triggered by filename:
 *   - block-<reason>.<ext> → rejected with `reason` as category
 *   - everything else      → allowed
 *
 * We can't easily encode test markers in the image bytes themselves
 * because the upload pipeline magic-number-validates the PNG header
 * (any prepended sentinel would be rejected by ParseFilePipe before
 * reaching this code). Filename is the simplest hook.
 */
@Injectable()
export class MockImageModerator implements ImageModerationProvider {
  readonly name = 'mock';

  async moderate(input: { buffer: Buffer; mime: string; filename?: string }):
      Promise<ImageModerationResult> {
    const name = (input.filename ?? '').toLowerCase();
    const match = /^block-([a-z]+)/.exec(name);
    if (match) {
      return {
        allowed: false,
        categories: [match[1]],
        reason: `mock filename trigger: ${match[0]}`,
      };
    }
    return { allowed: true, categories: [] };
  }
}
