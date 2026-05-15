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

    // For direct: peer is the other user.
    const directOtherMembers = await this.prisma.conversationMember.findMany({
      where: {
        conversationId: { in: conversationIds },
        userId: { not: userId },
        conversation: { type: ConversationType.direct },
      },
      include: {
        user: {
          select: { id: true, nickname: true, avatarUrl: true },
        },
      },
    });
    const directPeerByConv = new Map(
      directOtherMembers.map((m) => [m.conversationId, m.user]),
    );

    // For group: peer is the Group itself.
    const groupIds = memberships
      .filter((m) => m.conversation.type === ConversationType.group && m.conversation.peerId)
      .map((m) => m.conversation.peerId!);
    const groups = groupIds.length
      ? await this.prisma.group.findMany({
          where: { id: { in: groupIds } },
          select: { id: true, name: true, avatarUrl: true, memberCount: true },
        })
      : [];
    const groupById = new Map(groups.map((g) => [g.id, g]));

    // For bot: peer is the Bot.
    const botIds = memberships
      .filter((m) => m.conversation.type === ConversationType.bot && m.conversation.peerId)
      .map((m) => m.conversation.peerId!);
    const bots = botIds.length
      ? await this.prisma.bot.findMany({
          where: { id: { in: botIds } },
          select: { id: true, name: true, avatarUrl: true },
        })
      : [];
    const botById = new Map(bots.map((b) => [b.id, b]));

    const lastMsgIds = memberships
      .map((m) => m.conversation.lastMsgId)
      .filter((id): id is string => !!id);
    const lastMsgs = lastMsgIds.length
      ? await this.prisma.message.findMany({ where: { id: { in: lastMsgIds } } })
      : [];
    const lastMsgById = new Map(lastMsgs.map((m) => [m.id, m]));

    return memberships.map((m) => {
      const conv = m.conversation;
      let peer: { id: string; nickname: string; avatarUrl: string | null } | null = null;
      if (conv.type === ConversationType.direct) {
        const u = directPeerByConv.get(conv.id);
        if (u) peer = { id: u.id, nickname: u.nickname, avatarUrl: u.avatarUrl };
      } else if (conv.type === ConversationType.group && conv.peerId) {
        const g = groupById.get(conv.peerId);
        if (g) peer = { id: g.id, nickname: g.name, avatarUrl: g.avatarUrl };
      } else if (conv.type === ConversationType.bot && conv.peerId) {
        const b = botById.get(conv.peerId);
        if (b) peer = { id: b.id, nickname: b.name, avatarUrl: b.avatarUrl };
      }
      return {
        id: conv.id,
        type: conv.type,
        peer,
        unreadCount: m.unreadCount,
        muted: m.muted,
        lastMsgAt: conv.lastMsgAt,
        lastMessage: conv.lastMsgId ? lastMsgById.get(conv.lastMsgId) ?? null : null,
        lastReadMsgId: m.lastReadMsgId,
      };
    });
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
