import { Global, Module } from '@nestjs/common';
import { ImageModerationService } from './image-moderation.service';
import { MockImageModerator } from './providers/mock.provider';
import { OpenAIImageModerator } from './providers/openai.provider';

@Global()
@Module({
  providers: [ImageModerationService, MockImageModerator, OpenAIImageModerator],
  exports: [ImageModerationService],
})
export class ImageModerationModule {}
