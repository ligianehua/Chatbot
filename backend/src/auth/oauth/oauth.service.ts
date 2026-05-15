import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppleVerifier } from './apple.verifier';
import { GoogleVerifier } from './google.verifier';
import { MockOAuthVerifier } from './mock.verifier';
import { OAuthVerifiedClaims, OAuthVerifier } from './oauth.types';

export type OAuthProvider = 'apple' | 'google';

@Injectable()
export class OAuthService {
  private readonly logger = new Logger(OAuthService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly apple: AppleVerifier,
    private readonly google: GoogleVerifier,
    private readonly mock: MockOAuthVerifier,
  ) {}

  private pickVerifier(provider: OAuthProvider): OAuthVerifier {
    const mode = this.config.get<string>('OAUTH_MODE', '');
    if (mode === 'mock') {
      this.logger.warn(`OAUTH_MODE=mock — using MockOAuthVerifier for ${provider}`);
      return this.mock;
    }
    return provider === 'apple' ? this.apple : this.google;
  }

  async verify(provider: OAuthProvider, idToken: string): Promise<OAuthVerifiedClaims> {
    if (provider !== 'apple' && provider !== 'google') {
      throw new BadRequestException('provider must be apple or google');
    }
    if (!idToken || idToken.length < 8) {
      throw new BadRequestException('idToken required');
    }
    return this.pickVerifier(provider).verify(idToken);
  }
}
