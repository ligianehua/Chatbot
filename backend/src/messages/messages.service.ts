import { Injectable } from '@nestjs/common';
import { ConversationType, MessageType, Prisma } from '@prisma/client';
import { Snowflake } from '../common/snowflake';
import { ConversationsService } from '../conversations/conversations.service';
import { PrismaService } from '../prisma/prisma.service';

export interface SendTextInput {
  conversationId: string;
  senderId: string;
  text: string;
  clientMsgId?: string;
  replyToId?: string;
}

@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly conversations: ConversationsService,
  ) {}

  async sendText(input: SendTextInput) {
    await this.conversations.ensureMember(input.conversationId, input.senderId);
    return this.persist({
      conversationId: input.conversationId,
      senderId: input.senderId,
      type: MessageType.text,
      content: { text: input.text } as Prisma.InputJsonValue,
      replyToId: input.replyToId,
    });
  }

  /**
   * Persist a message and update conversation/last-msg + unread counts atomically.
   */
  private async persist(args: {
    conversationId: string;
    senderId: string;
    type: MessageType;
    content: Prisma.InputJsonValue;
    replyToId?: string;
  }) {
    const id = Snowflake.generate();
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      const message = await tx.message.create({
        data: {
          id,
          conversationId: args.conversationId,
          senderId: args.senderId,
          type: args.type,
          content: args.content,
          replyToId: args.replyToId,
          createdAt: now,
        },
      });
      await tx.conversation.update({
        where: { id: args.conversationId },
        data: { lastMsgId: id, lastMsgAt: now },
      });
      await tx.conversationMember.updateMany({
        where: { conversationId: args.conversationId, userId: { not: args.senderId } },
        data: { unreadCount: { increment: 1 } },
      });
      return message;
    });
  }

  async listInConversation(
    conversationId: string,
    userId: string,
    opts: { before?: string; limit?: number } = {},
  ) {
    await this.conversations.ensureMember(conversationId, userId);
    const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
    return this.prisma.message.findMany({
      where: {
        conversationId,
        ...(opts.before ? { id: { lt: opts.before } } : {}),
      },
      orderBy: { id: 'desc' },
      take: limit,
    });
  }

  /**
   * Sync: returns messages newer than `sinceMsgId` for any direct/group/bot
   * conversation the user belongs to. Capped at 500 per call; caller paginates.
   */
  async syncSince(userId: string, sinceMsgId: string | undefined, limit = 500) {
    const memberships = await this.prisma.conversationMember.findMany({
      where: { userId },
      select: { conversationId: true },
    });
    if (memberships.length === 0) return [];
    return this.prisma.message.findMany({
      where: {
        conversationId: { in: memberships.map((m) => m.conversationId) },
        ...(sinceMsgId ? { id: { gt: sinceMsgId } } : {}),
      },
      orderBy: { id: 'asc' },
      take: Math.min(Math.max(limit, 1), 500),
    });
  }
}
