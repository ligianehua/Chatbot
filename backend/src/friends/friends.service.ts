import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FriendshipStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FriendsService {
  constructor(private readonly prisma: PrismaService) {}

  async sendRequest(userId: string, friendId: string, remark?: string) {
    if (userId === friendId) {
      throw new BadRequestException('cannot add yourself');
    }

    const target = await this.prisma.user.findUnique({ where: { id: friendId } });
    if (!target) throw new NotFoundException('user not found');

    // If target has already requested, accept it instead of creating a duplicate.
    const inbound = await this.prisma.friendship.findUnique({
      where: { userId_friendId: { userId: friendId, friendId: userId } },
    });
    if (inbound) {
      if (inbound.status === FriendshipStatus.accepted) {
        return { status: FriendshipStatus.accepted, alreadyFriends: true };
      }
      if (inbound.status === FriendshipStatus.pending) {
        return this.acceptRequest(userId, friendId);
      }
    }

    const existing = await this.prisma.friendship.findUnique({
      where: { userId_friendId: { userId, friendId } },
    });
    if (existing) {
      if (existing.status === FriendshipStatus.accepted) {
        throw new ConflictException('already friends');
      }
      if (existing.status === FriendshipStatus.pending) {
        throw new ConflictException('request already sent');
      }
      if (existing.status === FriendshipStatus.blocked) {
        throw new ConflictException('user is blocked');
      }
    }

    await this.prisma.friendship.create({
      data: { userId, friendId, status: FriendshipStatus.pending, remark },
    });

    return { status: FriendshipStatus.pending };
  }

  async acceptRequest(userId: string, requesterId: string) {
    const request = await this.prisma.friendship.findUnique({
      where: { userId_friendId: { userId: requesterId, friendId: userId } },
    });
    if (!request || request.status !== FriendshipStatus.pending) {
      throw new NotFoundException('no pending request');
    }

    await this.prisma.$transaction([
      this.prisma.friendship.update({
        where: { userId_friendId: { userId: requesterId, friendId: userId } },
        data: { status: FriendshipStatus.accepted },
      }),
      this.prisma.friendship.upsert({
        where: { userId_friendId: { userId, friendId: requesterId } },
        update: { status: FriendshipStatus.accepted },
        create: { userId, friendId: requesterId, status: FriendshipStatus.accepted },
      }),
    ]);

    return { status: FriendshipStatus.accepted };
  }

  async rejectRequest(userId: string, requesterId: string) {
    const request = await this.prisma.friendship.findUnique({
      where: { userId_friendId: { userId: requesterId, friendId: userId } },
    });
    if (!request || request.status !== FriendshipStatus.pending) {
      throw new NotFoundException('no pending request');
    }
    await this.prisma.friendship.delete({
      where: { userId_friendId: { userId: requesterId, friendId: userId } },
    });
    return { ok: true };
  }

  async listFriends(userId: string) {
    const rows = await this.prisma.friendship.findMany({
      where: { userId, status: FriendshipStatus.accepted },
      include: {
        friend: {
          select: { id: true, nickname: true, avatarUrl: true, bio: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map((r) => ({
      id: r.friend.id,
      nickname: r.friend.nickname,
      avatarUrl: r.friend.avatarUrl,
      bio: r.friend.bio,
      remark: r.remark,
    }));
  }

  async listIncomingRequests(userId: string) {
    const rows = await this.prisma.friendship.findMany({
      where: { friendId: userId, status: FriendshipStatus.pending },
      include: {
        user: { select: { id: true, nickname: true, avatarUrl: true, bio: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => ({
      from: r.user,
      remark: r.remark,
      createdAt: r.createdAt,
    }));
  }

  async listOutgoingRequests(userId: string) {
    const rows = await this.prisma.friendship.findMany({
      where: { userId, status: FriendshipStatus.pending },
      include: {
        friend: { select: { id: true, nickname: true, avatarUrl: true, bio: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => ({
      to: r.friend,
      remark: r.remark,
      createdAt: r.createdAt,
    }));
  }

  async removeFriend(userId: string, friendId: string) {
    await this.prisma.friendship.deleteMany({
      where: {
        OR: [
          { userId, friendId },
          { userId: friendId, friendId: userId },
        ],
      },
    });
    return { ok: true };
  }
}
