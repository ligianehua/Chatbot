import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConversationType, FriendshipStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ConversationsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns the existing direct conversation between two users, creating it on demand.
   * Both users must be accepted friends.
   */
  async getOrCreateDirect(userId: string, peerId: string) {
    if (userId === peerId) throw new ForbiddenException('cannot chat with self');

    const friendship = await this.prisma.friendship.findUnique({
      where: { userId_friendId: { userId, friendId: peerId } },
    });
    if (!friendship || friendship.status !== FriendshipStatus.accepted) {
      throw new ForbiddenException('not friends');
    }

    // Find existing direct conversation by member intersection.
    const existing = await this.prisma.conversation.findFirst({
      where: {
        type: ConversationType.direct,
        AND: [
          { members: { some: { userId } } },
          { members: { some: { userId: peerId } } },
        ],
      },
    });
    if (existing) return existing;

    return this.prisma.conversation.create({
      data: {
        type: ConversationType.direct,
        members: {
          createMany: {
            data: [{ userId }, { userId: peerId }],
          },
        },
      },
    });
  }

  async listForUser(userId: string) {
    const memberships = await this.prisma.conversationMember.findMany({
      where: { userId },
      include: {
        conversation: true,
      },
      orderBy: { conversation: { lastMsgAt: 'desc' } },
    });

    if (memberships.length === 0) return [];

    const conversationIds = memberships.map((m) => m.conversationId);
    // Pull peer info for direct conversations.
    const allMembers = await this.prisma.conversationMember.findMany({
      where: {
        conversationId: { in: conversationIds },
        userId: { not: userId },
      },
      include: {
        user: {
          select: { id: true, nickname: true, avatarUrl: true },
        },
      },
    });
    const peersByConv = new Map<string, { id: string; nickname: string; avatarUrl: string | null }>();
    for (const m of allMembers) {
      peersByConv.set(m.conversationId, m.user);
    }

    const lastMsgIds = memberships
      .map((m) => m.conversation.lastMsgId)
      .filter((id): id is string => !!id);
    const lastMsgs = lastMsgIds.length
      ? await this.prisma.message.findMany({ where: { id: { in: lastMsgIds } } })
      : [];
    const lastMsgById = new Map(lastMsgs.map((m) => [m.id, m]));

    return memberships.map((m) => ({
      id: m.conversationId,
      type: m.conversation.type,
      peer: peersByConv.get(m.conversationId) ?? null,
      unreadCount: m.unreadCount,
      muted: m.muted,
      lastMsgAt: m.conversation.lastMsgAt,
      lastMessage: m.conversation.lastMsgId
        ? lastMsgById.get(m.conversation.lastMsgId) ?? null
        : null,
      lastReadMsgId: m.lastReadMsgId,
    }));
  }

  async ensureMember(conversationId: string, userId: string) {
    const member = await this.prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!member) throw new ForbiddenException('not a conversation member');
    return member;
  }

  async markRead(conversationId: string, userId: string, upToMsgId: string) {
    await this.ensureMember(conversationId, userId);
    await this.prisma.conversationMember.update({
      where: { conversationId_userId: { conversationId, userId } },
      data: { unreadCount: 0, lastReadMsgId: upToMsgId },
    });
  }

  async getMembers(conversationId: string) {
    const members = await this.prisma.conversationMember.findMany({
      where: { conversationId },
      select: { userId: true },
    });
    return members.map((m) => m.userId);
  }

  async findById(conversationId: string) {
    const conv = await this.prisma.conversation.findUnique({ where: { id: conversationId } });
    if (!conv) throw new NotFoundException('conversation not found');
    return conv;
  }
}
