import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createSign } from 'crypto';
import { IapVerifier, IapVerifyInput, IapVerifyResult } from '../iap.types';

/**
 * Google Play Developer API verifier (purchases.products.get for consumables).
 *
 * Required env:
 *   GOOGLE_PLAY_PACKAGE_NAME    — your app's package id (e.g. com.example.app)
 *   GOOGLE_PLAY_SERVICE_KEY_B64 — base64 of the service account JSON key with
 *                                 androidpublisher scope.
 *
 * Flow:
 *   1. Mint a short-lived JWT and exchange for OAuth2 access token.
 *   2. GET https://androidpublisher.googleapis.com/androidpublisher/v3/applications/{pkg}/purchases/products/{sku}/tokens/{token}
 *   3. purchaseState=0 means PURCHASED; consumed/refunded states reject.
 */
@Injectable()
export class GoogleIapVerifier implements IapVerifier {
  readonly provider = 'google' as const;
  private readonly logger = new Logger(GoogleIapVerifier.name);

  // Cached short-lived OAuth token.
  private cachedToken?: { token: string; expiresAt: number };

  constructor(private readonly config: ConfigService) {}

  private get pkg(): string {
    return this.config.get<string>('GOOGLE_PLAY_PACKAGE_NAME', '');
  }

  private async getAccessToken(): Promise<string> {
    if (this.cachedToken && this.cachedToken.expiresAt > Date.now() + 60_000) {
      return this.cachedToken.token;
    }
    const b64 = this.config.get<string>('GOOGLE_PLAY_SERVICE_KEY_B64', '');
    if (!b64) throw new Error('GOOGLE_PLAY_SERVICE_KEY_B64 not set');
    const key = JSON.parse(Buffer.from(b64, 'base64').toString('utf8')) as {
      client_email: string;
      private_key: string;
      token_uri: string;
    };
    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const claim = Buffer.from(JSON.stringify({
      iss: key.client_email,
      scope: 'https://www.googleapis.com/auth/androidpublisher',
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
    const json = await res.json() as { access_token: string; expires_in: number };
    this.cachedToken = {
      token: json.access_token,
      expiresAt: Date.now() + json.expires_in * 1000,
    };
    return json.access_token;
  }

  async verify(input: IapVerifyInput): Promise<IapVerifyResult> {
    if (!this.pkg) {
      return { valid: false, transactionId: '', productId: input.productId, reason: 'GOOGLE_PLAY_PACKAGE_NAME not set' };
    }
    try {
      const access = await this.getAccessToken();
      const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(this.pkg)}/purchases/products/${encodeURIComponent(input.productId)}/tokens/${encodeURIComponent(input.receipt)}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${access}` } });
      if (!res.ok) {
        return { valid: false, transactionId: '', productId: input.productId, reason: `play api ${res.status}` };
      }
      const body = await res.json() as {
        purchaseState?: number;
        purchaseTimeMillis?: string;
        orderId?: string;
        consumptionState?: number;
      };
      // 0 = PURCHASED, 1 = CANCELED, 2 = PENDING
      if (body.purchaseState !== 0) {
        return { valid: false, transactionId: '', productId: input.productId, reason: `purchaseState=${body.purchaseState}` };
      }
      if (!body.orderId) {
        return { valid: false, transactionId: '', productId: input.productId, reason: 'no orderId' };
      }
      return {
        valid: true,
        productId: input.productId,
        transactionId: body.orderId,
        purchaseTimeMs: body.purchaseTimeMillis ? parseInt(body.purchaseTimeMillis, 10) : undefined,
      };
    } catch (e) {
      this.logger.warn(`google iap verify failed: ${e instanceof Error ? e.message : e}`);
      return { valid: false, transactionId: '', productId: input.productId, reason: 'verify failed' };
    }
  }
}
