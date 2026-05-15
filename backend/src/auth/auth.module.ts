import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AppleVerifier } from './oauth/apple.verifier';
import { GoogleVerifier } from './oauth/google.verifier';
import { MockOAuthVerifier } from './oauth/mock.verifier';
import { OAuthService } from './oauth/oauth.service';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    ConfigModule,
    PassportModule,
    JwtModule.register({}),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    OAuthService,
    AppleVerifier,
    GoogleVerifier,
    MockOAuthVerifier,
  ],
  exports: [AuthService],
})
export class AuthModule {}
