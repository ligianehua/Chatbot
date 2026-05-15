import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Bot,
  BotStatus,
  ConversationType,
  MessageType,
  Prisma,
} from '@prisma/client';
import { Snowflake } from '../common/snowflake';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBotDto } from './dto/create-bot.dto';
import { UpdateBotDto } from './dto/update-bot.dto';

@Injectable()
export class BotsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateBotDto): Promise<Bot> {
    return this.prisma.bot.create({
      data: {
        creatorId: userId,
        name: dto.name,
        avatarUrl: dto.avatarUrl,
        gender: dto.gender,
        age: dto.age,
        occupation: dto.occupation,
        bio: dto.bio,
        systemPrompt: dto.systemPrompt,
        model: dto.model ?? 'deepseek-chat',
        temperature: dto.temperature ?? 0.7,
        welcomeMsg: dto.welcomeMsg,
        isPublic: dto.isPublic ?? false,
        status: BotStatus.listed,
      },
    });
  }

  async listMine(userId: string): Promise<Bot[]> {
    return this.prisma.bot.findMany({
      where: { creatorId: userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getById(id: string): Promise<Bot> {
    const bot = await this.prisma.bot.findUnique({ where: { id } });
    if (!bot) throw new NotFoundException('bot not found');
    return bot;
  }

  async update(userId: string, id: string, dto: UpdateBotDto): Promise<Bot> {
    const bot = await this.getById(id);
    if (bot.creatorId !== userId) throw new ForbiddenException('not the bot creator');
    return this.prisma.bot.update({
      where: { id },
      data: dto,
    });
  }

  async delete(userId: string, id: string): Promise<void> {
    const bot = await this.getById(id);
    if (bot.creatorId !== userId) throw new ForbiddenException('not the bot creator');
    await this.prisma.bot.delete({ where: { id } });
  }

  /**
   * Opens or reuses the bot-chat conversation for this user.
   * For MVP, only the bot creator can chat with their own bot (P1: subscribers).
   * Seeds the welcome message on first creation.
   */
  async openConversation(userId: string, botId: string) {
    const bot = await this.getById(botId);
    if (bot.creatorId !== userId && !bot.isPublic) {
      throw new ForbiddenException('not allowed to chat with this bot');
    }

    const existing = await this.prisma.conversation.findFirst({
      where: {
        type: ConversationType.bot,
        peerId: botId,
        members: { some: { userId } },
      },
    });
    if (existing) return existing;

    const conv = await this.prisma.conversation.create({
      data: {
        type: ConversationType.bot,
        peerId: botId,
        members: { createMany: { data: [{ userId }] } },
      },
    });

    if (bot.welcomeMsg && bot.welcomeMsg.trim().length > 0) {
      const id = Snowflake.generate();
      await this.prisma.$transaction([
        this.prisma.message.create({
          data: {
            id,
            conversationId: conv.id,
            senderId: null, // bot
            type: MessageType.text,
            content: { text: bot.welcomeMsg, botId } as Prisma.InputJsonValue,
          },
        }),
        this.prisma.conversation.update({
          where: { id: conv.id },
          data: { lastMsgId: id, lastMsgAt: new Date() },
        }),
        this.prisma.conversationMember.update({
          where: { conversationId_userId: { conversationId: conv.id, userId } },
          data: { unreadCount: 1 },
        }),
      ]);
    }
    return conv;
  }

  /**
   * Used by ChatGateway when a message arrives in a bot conversation: returns
   * the bot tied to that conversation, plus throws if the user is not the member.
   */
  async resolveBotForConversation(conversationId: string, userId: string) {
    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { members: { where: { userId } } },
    });
    if (!conv) throw new NotFoundException('conversation not found');
    if (conv.type !== ConversationType.bot) {
      throw new BadRequestException('not a bot conversation');
    }
    if (conv.members.length === 0) throw new ForbiddenException('not a member');
    if (!conv.peerId) throw new BadRequestException('conversation missing peer/bot id');
    return this.getById(conv.peerId);
  }
}
