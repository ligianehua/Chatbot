import { Global, Module } from '@nestjs/common';
import { LlmService } from './llm.service';
import { ModerationService } from './moderation.service';
import { DeepSeekProvider } from './providers/deepseek.provider';
import { MockProvider } from './providers/mock.provider';

@Global()
@Module({
  providers: [LlmService, ModerationService, DeepSeekProvider, MockProvider],
  exports: [LlmService, ModerationService],
})
export class LlmModule {}
