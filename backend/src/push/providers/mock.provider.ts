import { Injectable } from '@nestjs/common';
import { PushNotification, PushProvider, PushSendResult } from '../push.types';

export interface MockPushLogEntry {
  at: number;
  tokens: string[];
  notification: PushNotification;
}

/**
 * Records each send in a bounded ring buffer so e2e tests can inspect what
 * the backend tried to push without standing up a real FCM project.
 * Enabled when PUSH_MODE=mock.
 */
@Injectable()
export class MockPushProvider implements PushProvider {
  readonly name = 'mock';
  private readonly log: MockPushLogEntry[] = [];
  private static readonly MAX = 200;

  async sendMulticast(tokens: string[], notification: PushNotification): Promise<PushSendResult[]> {
    this.log.push({ at: Date.now(), tokens: [...tokens], notification });
    while (this.log.length > MockPushProvider.MAX) this.log.shift();
    // Mark "bad-*" tokens as unregistered so the cleanup path is also exercised.
    return tokens.map((t) =>
      t.startsWith('bad-')
        ? { token: t, success: false, errorCode: 'unregistered' as const }
        : { token: t, success: true },
    );
  }

  getLog(): MockPushLogEntry[] {
    return [...this.log];
  }

  clear(): void {
    this.log.length = 0;
  }
}
