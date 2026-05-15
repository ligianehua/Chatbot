import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { OAuthVerifiedClaims, OAuthVerifier } from './oauth.types';

const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];
const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';

@Injectable()
export class GoogleVerifier implements OAuthVerifier {
  readonly provider = 'google' as const;
  private readonly logger = new Logger(GoogleVerifier.name);
  private jwksCache?: ReturnType<typeof createRemoteJWKSet>;

  constructor(private readonly config: ConfigService) {}

  private getClientIds(): string[] {
    const raw = this.config.get<string>('GOOGLE_CLIENT_IDS', '');
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  private getJwks() {
    if (!this.jwksCache) {
      this.jwksCache = createRemoteJWKSet(new URL(GOOGLE_JWKS_URL));
    }
    return this.jwksCache;
  }

  async verify(idToken: string): Promise<OAuthVerifiedClaims> {
    const clientIds = this.getClientIds();
    if (clientIds.length === 0) {
      throw new UnauthorizedException('GOOGLE_CLIENT_IDS not configured');
    }
    try {
      const { payload } = await jwtVerify(idToken, this.getJwks(), {
        issuer: GOOGLE_ISSUERS,
        audience: clientIds,
      });
      if (!payload.sub) throw new Error('missing sub');
      return {
        sub: String(payload.sub),
        email: typeof payload.email === 'string' ? payload.email : null,
        emailVerified: payload.email_verified === true || undefined,
        name: typeof payload.name === 'string' ? payload.name : null,
        picture: typeof payload.picture === 'string' ? payload.picture : null,
      };
    } catch (e) {
      this.logger.warn(`google verify failed: ${e instanceof Error ? e.message : e}`);
      throw new UnauthorizedException('invalid google id token');
    }
  }
}
