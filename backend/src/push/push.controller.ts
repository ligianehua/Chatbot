import { Controller, ForbiddenException, Get, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MockPushProvider } from './providers/mock.provider';

/**
 * Test-only inspection endpoint. Guarded by PUSH_MODE=mock so production
 * builds (which use the real FCM provider) cannot leak this surface.
 */
@Controller('admin/push')
@UseGuards(JwtAuthGuard)
export class PushController {
  constructor(
    private readonly config: ConfigService,
    private readonly mock: MockPushProvider,
  ) {}

  @Get('log')
  log() {
    if (this.config.get<string>('PUSH_MODE') !== 'mock') {
      throw new ForbiddenException('PUSH_MODE != mock');
    }
    return this.mock.getLog();
  }
}
