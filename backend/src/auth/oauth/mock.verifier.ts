import { Injectable, UnauthorizedException } from '@nestjs/common';
import { OAuthVerifiedClaims, OAuthVerifier } from './oauth.types';

/**
 * Used when OAUTH_MODE=mock. Tokens are unsigned JSON encoded as
 *   mock.<base64(JSON)>
 * The mock accepts any provider name and just round-trips claims.
 *
 * Production should never set OAUTH_MODE=mock — the real Apple/Google
 * verifiers are selected by default.
 */
@Injectable()
export class MockOAuthVerifier implements OAuthVerifier {
  readonly provider = 'apple' as const; // unused

  async verify(idToken: string): Promise<OAuthVerifiedClaims> {
    if (!idToken.startsWith('mock.')) {
      throw new UnauthorizedException('mock token must begin with "mock."');
    }
    try {
      const json = Buffer.from(idToken.slice(5), 'base64').toString('utf8');
      const claims = JSON.parse(json);
      if (!claims.sub) throw new Error('missing sub');
      return {
        sub: String(claims.sub),
        email: typeof claims.email === 'string' ? claims.email : null,
        emailVerified: claims.email_verified === true ? true : undefined,
        name: typeof claims.name === 'string' ? claims.name : null,
        picture: typeof claims.picture === 'string' ? claims.picture : null,
      };
    } catch (e) {
      throw new UnauthorizedException('invalid mock token');
    }
  }
}
