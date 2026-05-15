import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { OAuthVerifiedClaims, OAuthVerifier } from './oauth.types';

const APPLE_ISSUER = 'https://appleid.apple.com';
const APPLE_JWKS_URL = 'https://appleid.apple.com/auth/keys';

@Injectable()
export class AppleVerifier implements OAuthVerifier {
  readonly provider = 'apple' as const;
  private readonly logger = new Logger(AppleVerifier.name);
  private jwksCache?: ReturnType<typeof createRemoteJWKSet>;

  constructor(private readonly config: ConfigService) {}

  /**
   * Audience can be a bundle id (native Sign in with Apple) or a Service ID
   * (web flow). We accept a comma-separated allowlist from APPLE_AUDIENCES.
   */
  private getAudiences(): string[] {
    const raw = this.config.get<string>('APPLE_AUDIENCES', '');
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  private getJwks() {
    if (!this.jwksCache) {
      this.jwksCache = createRemoteJWKSet(new URL(APPLE_JWKS_URL));
    }
    return this.jwksCache;
  }

  async verify(idToken: string): Promise<OAuthVerifiedClaims> {
    const audiences = this.getAudiences();
    if (audiences.length === 0) {
      throw new UnauthorizedException('APPLE_AUDIENCES not configured');
    }
    try {
      const { payload } = await jwtVerify(idToken, this.getJwks(), {
        issuer: APPLE_ISSUER,
        audience: audiences,
      });
      if (!payload.sub) throw new Error('missing sub');
      return {
        sub: String(payload.sub),
        email: typeof payload.email === 'string' ? payload.email : null,
        emailVerified:
          payload.email_verified === true ||
          payload.email_verified === 'true' ||
          undefined,
        name: null, // Apple doesn't include name in the id token; client may pass separately
      };
    } catch (e) {
      this.logger.warn(`apple verify failed: ${e instanceof Error ? e.message : e}`);
      throw new UnauthorizedException('invalid apple id token');
    }
  }
}
