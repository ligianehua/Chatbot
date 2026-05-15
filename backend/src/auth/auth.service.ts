import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from './strategies/jwt.strategy';

const BCRYPT_ROUNDS = 10;
const REFRESH_TTL_DAYS = 30;
const RESET_TOKEN_TTL_MIN = 30;

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface PublicUser {
  id: string;
  email: string | null;
  nickname: string;
  avatarUrl: string | null;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(email: string, password: string, nickname: string): Promise<{ user: PublicUser; tokens: AuthTokens }> {
    const normalized = email.toLowerCase().trim();
    const existing = await this.prisma.user.findUnique({ where: { email: normalized } });
    if (existing) {
      throw new ConflictException('email already registered');
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await this.prisma.user.create({
      data: {
        email: normalized,
        passwordHash,
        nickname,
      },
    });

    const tokens = await this.issueTokens(user.id, user.email);
    return { user: this.toPublic(user), tokens };
  }

  async login(email: string, password: string): Promise<{ user: PublicUser; tokens: AuthTokens }> {
    const normalized = email.toLowerCase().trim();
    const user = await this.prisma.user.findUnique({ where: { email: normalized } });
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('invalid credentials');
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('invalid credentials');
    }

    const tokens = await this.issueTokens(user.id, user.email);
    return { user: this.toPublic(user), tokens };
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    const refreshSecret = this.config.get<string>('JWT_REFRESH_SECRET');
    if (!refreshSecret) throw new UnauthorizedException('refresh not configured');

    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(refreshToken, { secret: refreshSecret });
    } catch {
      throw new UnauthorizedException('invalid refresh token');
    }

    const tokenHash = this.hashToken(refreshToken);
    const session = await this.prisma.session.findFirst({
      where: { userId: payload.sub, refreshTokenHash: tokenHash },
    });
    if (!session || session.expiresAt < new Date()) {
      throw new UnauthorizedException('refresh session expired');
    }

    // Rotate: delete old session, issue new tokens with a fresh session row
    await this.prisma.session.delete({ where: { id: session.id } });
    return this.issueTokens(payload.sub, payload.email);
  }

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = this.hashToken(refreshToken);
    await this.prisma.session.deleteMany({ where: { refreshTokenHash: tokenHash } });
  }

  async forgotPassword(email: string): Promise<{ devToken?: string }> {
    const normalized = email.toLowerCase().trim();
    const user = await this.prisma.user.findUnique({ where: { email: normalized } });

    // Always behave as if it succeeded (prevent email enumeration). Only generate token if user exists.
    if (!user) {
      this.logger.log(`forgotPassword for non-existent email ${normalized} — silent ok`);
      return {};
    }

    const token = randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(token);
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MIN * 60 * 1000),
      },
    });

    // TODO[阶段 4]: integrate email provider (SendGrid/AWS SES). For now, log token in dev.
    if (this.config.get<string>('NODE_ENV') !== 'production') {
      this.logger.warn(`[DEV] password reset token for ${normalized}: ${token}`);
      return { devToken: token };
    }
    this.logger.log(`password reset token issued for ${normalized}`);
    return {};
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const tokenHash = this.hashToken(token);
    const record = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash } });
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new BadRequestException('invalid or expired token');
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
      this.prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
      // Revoke all existing sessions; force re-login
      this.prisma.session.deleteMany({ where: { userId: record.userId } }),
    ]);
  }

  private async issueTokens(userId: string, email: string | null): Promise<AuthTokens> {
    const accessSecret = this.config.get<string>('JWT_ACCESS_SECRET');
    const refreshSecret = this.config.get<string>('JWT_REFRESH_SECRET');
    const accessTtl = this.config.get<string>('JWT_ACCESS_TTL', '15m');
    const refreshTtl = this.config.get<string>('JWT_REFRESH_TTL', '30d');
    if (!accessSecret || !refreshSecret) {
      throw new UnauthorizedException('JWT secrets not configured');
    }

    const basePayload: JwtPayload = { sub: userId, email };
    const accessSec = this.parseDurationSeconds(accessTtl);
    const refreshSec = this.parseDurationSeconds(refreshTtl);

    // jti makes each token unique even when two are issued in the same second.
    const accessJti = randomUUID();
    const refreshJti = randomUUID();
    const accessToken = await this.jwt.signAsync(
      { ...basePayload, jti: accessJti },
      { secret: accessSecret, expiresIn: accessSec },
    );
    const refreshToken = await this.jwt.signAsync(
      { ...basePayload, jti: refreshJti },
      { secret: refreshSecret, expiresIn: refreshSec },
    );

    await this.prisma.session.create({
      data: {
        userId,
        refreshTokenHash: this.hashToken(refreshToken),
        expiresAt: new Date(Date.now() + refreshSec * 1000),
      },
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: accessSec,
    };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private parseDurationSeconds(s: string): number {
    const m = s.match(/^(\d+)([smhd])$/);
    if (!m) return 900;
    const n = parseInt(m[1], 10);
    switch (m[2]) {
      case 's': return n;
      case 'm': return n * 60;
      case 'h': return n * 3600;
      case 'd': return n * 86400;
      default: return 900;
    }
  }

  private toPublic(user: { id: string; email: string | null; nickname: string; avatarUrl: string | null }): PublicUser {
    return {
      id: user.id,
      email: user.email,
      nickname: user.nickname,
      avatarUrl: user.avatarUrl,
    };
  }
}
