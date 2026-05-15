import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { FcmProvider } from './providers/fcm.provider';
import { MockPushProvider } from './providers/mock.provider';
import { PushNotification, PushProvider } from './push.types';

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly fcm: FcmProvider,
    private readonly mock: MockPushProvider,
  ) {}

  isMockMode(): boolean {
    return this.config.get<string>('PUSH_MODE', '') === 'mock';
  }

  private pickProvider(): PushProvider {
    return this.isMockMode() ? this.mock : this.fcm;
  }

  /**
   * Fire-and-forget delivery to all of the user's registered devices.
   * Failure or dead-token cleanup is handled internally — never bubbles
   * into the caller's request path.
   */
  async sendToUser(userId: string, notification: PushNotification): Promise<void> {
    try {
      const devices = await this.prisma.device.findMany({
        where: { userId, pushToken: { not: null } },
      });
      if (devices.length === 0) return;

      const provider = this.pickProvider();
      const tokens = devices.map((d) => d.pushToken!);
      const results = await provider.sendMulticast(tokens, notification);

      for (let i = 0; i < results.length; i++) {
        const r = results[i];
        if (!r.success && (r.errorCode === 'unregistered' || r.errorCode === 'invalid-token')) {
          await this.prisma.device
            .update({ where: { id: devices[i].id }, data: { pushToken: null } })
            .catch(() => {/* best-effort cleanup */});
          this.logger.log(`pruned dead push token for user=${userId} device=${devices[i].id}`);
        }
      }
    } catch (e) {
      this.logger.warn(`sendToUser ${userId} failed: ${e instanceof Error ? e.message : e}`);
    }
  }
}
