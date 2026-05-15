import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('user not found');
    return this.toPrivateProfile(user);
  }

  async getById(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('user not found');
    return this.toPublicProfile(user);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        nickname: dto.nickname,
        avatarUrl: dto.avatarUrl,
        gender: dto.gender,
        birthday: dto.birthday ? new Date(dto.birthday) : undefined,
        region: dto.region,
        bio: dto.bio,
      },
    });
    return this.toPrivateProfile(user);
  }

  async searchByEmailOrId(query: string) {
    const trimmed = query.trim();
    if (trimmed.length < 2) return [];

    const users = await this.prisma.user.findMany({
      where: {
        OR: [
          { email: { equals: trimmed.toLowerCase() } },
          { id: trimmed },
          { nickname: { contains: trimmed, mode: 'insensitive' } },
        ],
      },
      take: 20,
    });
    return users.map((u) => this.toPublicProfile(u));
  }

  private toPrivateProfile(u: {
    id: string;
    email: string | null;
    phone: string | null;
    nickname: string;
    avatarUrl: string | null;
    gender: string | null;
    birthday: Date | null;
    region: string | null;
    bio: string | null;
    createdAt: Date;
  }) {
    return {
      id: u.id,
      email: u.email,
      phone: u.phone,
      nickname: u.nickname,
      avatarUrl: u.avatarUrl,
      gender: u.gender,
      birthday: u.birthday,
      region: u.region,
      bio: u.bio,
      createdAt: u.createdAt,
    };
  }

  private toPublicProfile(u: {
    id: string;
    nickname: string;
    avatarUrl: string | null;
    gender: string | null;
    region: string | null;
    bio: string | null;
  }) {
    return {
      id: u.id,
      nickname: u.nickname,
      avatarUrl: u.avatarUrl,
      gender: u.gender,
      region: u.region,
      bio: u.bio,
    };
  }
}
