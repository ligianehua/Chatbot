import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createSign } from 'crypto';
import { PushNotification, PushProvider, PushSendResult } from '../push.types';

/**
 * FCM HTTP v1 push provider.
 *
 * iOS apps that registered through firebase_messaging also get FCM tokens —
 * Firebase routes the message to APNs internally. So a single sender works
 * for both platforms without a separate APNs HTTP/2 client.
 *
 * Required env:
 *   FCM_PROJECT_ID                — your Firebase project id.
 *   FCM_SERVICE_KEY_B64           — base64 of the service account JSON
 *                                   (firebase-adminsdk-* file) with the
 *                                   firebase.messaging scope.
 */
@Injectable()
export class FcmProvider implements PushProvider {
  readonly name = 'fcm';
  private readonly logger = new Logger(FcmProvider.name);

  private tokenCache?: { value: string; expiresAt: number };

  constructor(private readonly config: ConfigService) {}

  private get projectId(): string {
    return this.config.get<string>('FCM_PROJECT_ID', '');
  }

  private async getAccessToken(): Promise<string> {
    if (this.tokenCache && this.tokenCache.expiresAt > Date.now() + 60_000) {
      return this.tokenCache.value;
    }
    const b64 = this.config.get<string>('FCM_SERVICE_KEY_B64', '');
    if (!b64) throw new Error('FCM_SERVICE_KEY_B64 not set');
    const key = JSON.parse(Buffer.from(b64, 'base64').toString('utf8')) as {
      client_email: string;
      private_key: string;
      token_uri: string;
    };
    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const claim = Buffer.from(JSON.stringify({
      iss: key.client_email,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: key.token_uri,
      iat: now,
      exp: now + 3600,
    })).toString('base64url');
    const signer = createSign('RSA-SHA256');
    signer.update(`${header}.${claim}`);
    const sig = signer.sign(key.private_key).toString('base64url');
    const assertion = `${header}.${claim}.${sig}`;

    const res = await fetch(key.token_uri, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }).toString(),
    });
    if (!res.ok) throw new Error(`token exchange ${res.status}: ${await res.text()}`);
    const json = (await res.json()) as { access_token: string; expires_in: number };
    this.tokenCache = {
      value: json.access_token,
      expiresAt: Date.now() + json.expires_in * 1000,
    };
    return json.access_token;
  }

  async sendMulticast(tokens: string[], notification: PushNotification): Promise<PushSendResult[]> {
    if (!this.projectId) {
      throw new Error('FCM_PROJECT_ID not set');
    }
    const access = await this.getAccessToken();
    const url = `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(this.projectId)}/messages:send`;
    // FCM v1 has no batch endpoint; concurrent sends are the documented pattern.
    return Promise.all(
      tokens.map(async (token): Promise<PushSendResult> => {
        try {
          const res = await fetch(url, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${access}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              message: {
                token,
                notification: { title: notification.title, body: notification.body },
                data: notification.data,
              },
            }),
          });
          if (res.ok) return { token, success: true };
          const body = await res.json().catch(() => ({})) as { error?: { status?: string; message?: string } };
          const status = body?.error?.status ?? '';
          const errorCode: PushSendResult['errorCode'] =
            status === 'NOT_FOUND' || status === 'UNREGISTERED'
              ? 'unregistered'
              : status === 'INVALID_ARGUMENT'
                ? 'invalid-token'
                : status === 'RESOURCE_EXHAUSTED' || status === 'QUOTA_EXCEEDED'
                  ? 'rate-limited'
                  : 'other';
          return { token, success: false, errorCode, message: body?.error?.message ?? `${res.status}` };
        } catch (e) {
          this.logger.warn(`fcm send error for token ${token.slice(0, 8)}…: ${e instanceof Error ? e.message : e}`);
          return { token, success: false, errorCode: 'other', message: String(e) };
        }
      }),
    );
  }
}
