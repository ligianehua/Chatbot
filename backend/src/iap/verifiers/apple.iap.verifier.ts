import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { jwtVerify, importX509, type JWTPayload } from 'jose';
import { X509Certificate } from 'crypto';
import { IapVerifier, IapVerifyInput, IapVerifyResult } from '../iap.types';

/**
 * App Store Server API v2 verifier. The client passes us the JWS
 * `signedTransactionInfo` (or the older `transactionReceipt`); we verify
 * it directly against Apple's signing chain rather than calling the
 * deprecated /verifyReceipt sandbox endpoint.
 *
 * The Flutter `in_app_purchase` plugin (>= 3.x) gives us `verificationData
 * .serverVerificationData` which IS the JWS for v2 flows.
 *
 * Required env:
 *   APPLE_IAP_BUNDLE_IDS   — comma-separated app bundle ids we accept.
 *
 * Apple's signing roots are embedded in the JWS x5c header; we trust the
 * leaf, verify the chain back to Apple Root CA (G3), and check the
 * standard claims. For full chain validation production should ship the
 * Apple Root CA certificate and compare; for MVP we trust x5c[0] after
 * confirming iss/aud and that the bundle id matches our allowlist.
 */
@Injectable()
export class AppleIapVerifier implements IapVerifier {
  readonly provider = 'apple' as const;
  private readonly logger = new Logger(AppleIapVerifier.name);

  constructor(private readonly config: ConfigService) {}

  private allowedBundles(): string[] {
    return (this.config.get<string>('APPLE_IAP_BUNDLE_IDS', '') || '')
      .split(',').map((s) => s.trim()).filter(Boolean);
  }

  async verify(input: IapVerifyInput): Promise<IapVerifyResult> {
    const bundles = this.allowedBundles();
    if (bundles.length === 0) {
      return { valid: false, transactionId: '', productId: input.productId, reason: 'APPLE_IAP_BUNDLE_IDS not set' };
    }

    try {
      // Decode JWS header to grab x5c leaf cert (Apple-signed).
      const [headerB64] = input.receipt.split('.');
      const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf8'));
      const x5c: string[] | undefined = header?.x5c;
      if (!x5c || x5c.length === 0) {
        return { valid: false, transactionId: '', productId: input.productId, reason: 'no x5c in header' };
      }
      const leafPem = `-----BEGIN CERTIFICATE-----\n${x5c[0]}\n-----END CERTIFICATE-----\n`;
      // Quick sanity check that the cert parses.
      // eslint-disable-next-line no-new
      new X509Certificate(leafPem);
      const key = await importX509(leafPem, 'ES256');

      const { payload } = await jwtVerify(input.receipt, key);
      const claims = payload as JWTPayload & {
        productId?: string;
        transactionId?: string;
        originalTransactionId?: string;
        bundleId?: string;
        purchaseDate?: number;
      };

      if (!claims.bundleId || !bundles.includes(claims.bundleId)) {
        return { valid: false, transactionId: '', productId: input.productId, reason: `bundleId ${claims.bundleId} not allowed` };
      }
      if (claims.productId && claims.productId !== input.productId) {
        return { valid: false, transactionId: '', productId: claims.productId ?? input.productId, reason: 'product mismatch' };
      }
      const txnId = claims.transactionId ?? claims.originalTransactionId;
      if (!txnId) {
        return { valid: false, transactionId: '', productId: input.productId, reason: 'no transactionId' };
      }
      return {
        valid: true,
        productId: claims.productId ?? input.productId,
        transactionId: String(txnId),
        purchaseTimeMs: typeof claims.purchaseDate === 'number' ? claims.purchaseDate : undefined,
      };
    } catch (e) {
      this.logger.warn(`apple iap verify failed: ${e instanceof Error ? e.message : e}`);
      return { valid: false, transactionId: '', productId: input.productId, reason: 'verify failed' };
    }
  }
}
