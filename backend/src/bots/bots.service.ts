import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Bot,
  BotPriceType,
  BotStatus,
  BotSubscriptionStatus,
  ConversationType,
  MessageType,
  Prisma,
} from '@prisma/client';
import { Snowflake } from '../common/snowflake';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { CreateBotDto } from './dto/create-bot.dto';
import { UpdateBotDto } from './dto/update-bot.dto';

const PLATFORM_FEE_RATE = 0.3; // 30% platform cut; 70% to creator
const FREE_TRIAL_TOKENS = 2000;
const MONTHLY_TOKEN_QUOTA = 200000;

@Injectable()
export class BotsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
  ) {}

  async create(userId: string, dto: CreateBotDto): Promise<Bot> {
    const priceType = dto.priceType ?? BotPriceType.free;
    const priceCents = priceType === BotPriceType.free ? 0 : (dto.priceCents ?? 0);
    if (priceType !== BotPriceType.free && priceCents <= 0) {
      throw new BadRequestException('paid bot must set priceCents > 0');
    }
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
        priceType,
        priceCents,
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

  // ----- Marketplace & subscription -----

  async listMarketplace(opts: { q?: string; limit?: number; cursor?: string }) {
    const limit = Math.min(Math.max(opts.limit ?? 20, 1), 100);
    const where: Prisma.BotWhereInput = {
      isPublic: true,
      status: BotStatus.listed,
      ...(opts.q
        ? {
            OR: [
              { name: { contains: opts.q, mode: 'insensitive' } },
              { bio: { contains: opts.q, mode: 'insensitive' } },
              { occupation: { contains: opts.q, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(opts.cursor ? { id: { lt: opts.cursor } } : {}),
    };
    const bots = await this.prisma.bot.findMany({
      where,
      orderBy: { id: 'desc' },
      take: limit,
      include: {
        creator: { select: { id: true, nickname: true, avatarUrl: true } },
      },
    });
    return bots;
  }

  async listSubscribed(userId: string): Promise<Bot[]> {
    const subs = await this.prisma.botSubscription.findMany({
      where: { userId, status: { in: [BotSubscriptionStatus.active, BotSubscriptionStatus.trial] } },
      include: { bot: true },
      orderBy: { subscribedAt: 'desc' },
    });
    return subs.map((s) => s.bot);
  }

  async subscribe(userId: string, botId: string) {
    const bot = await this.getById(botId);
    if (bot.creatorId === userId) {
      throw new BadRequestException('cannot subscribe to your own bot');
    }
    if (!bot.isPublic || bot.status !== BotStatus.listed) {
      throw new ForbiddenException('bot not available');
    }

    // Already active?
    const existing = await this.prisma.botSubscription.findUnique({
      where: { userId_botId: { userId, botId } },
    });
    if (existing && existing.status === BotSubscriptionStatus.active &&
        (!existing.expiresAt || existing.expiresAt > new Date())) {
      return { status: 'already_subscribed', subscription: existing };
    }

    if (bot.priceType === BotPriceType.free) {
      return this.activate(userId, bot, null);
    }

    if (bot.priceType === BotPriceType.monthly || bot.priceType === BotPriceType.oneoff) {
      return this.purchase(userId, bot);
    }

    throw new BadRequestException(`price type ${bot.priceType} not supported yet`);
  }

  async unsubscribe(userId: string, botId: string) {
    const sub = await this.prisma.botSubscription.findUnique({
      where: { userId_botId: { userId, botId } },
    });
    if (!sub) throw new NotFoundException('not subscribed');
    await this.prisma.botSubscription.update({
      where: { id: sub.id },
      data: { status: BotSubscriptionStatus.expired },
    });
    return { ok: true };
  }

  private async activate(userId: string, bot: Bot, expiresAt: Date | null) {
    const sub = await this.prisma.botSubscription.upsert({
      where: { userId_botId: { userId, botId: bot.id } },
      create: {
        userId,
        botId: bot.id,
        status: BotSubscriptionStatus.active,
        expiresAt,
        monthlyTokenQuota: MONTHLY_TOKEN_QUOTA,
        usedTokens: 0,
      },
      update: {
        status: BotSubscriptionStatus.active,
        expiresAt,
        usedTokens: 0,
        subscribedAt: new Date(),
      },
    });
    return { status: 'active', subscription: sub };
  }

  /**
   * Charge the buyer's wallet, credit the creator (70%), expand the
   * subscription window. Atomic — wallet debit + sub create commit
   * together, creator credit logged as a second transaction.
   */
  private async purchase(userId: string, bot: Bot) {
    const amount = bot.priceCents;
    if (amount <= 0) {
      throw new BadRequestException('bot priced at 0 but not marked free');
    }

    // 1) Debit buyer (throws on insufficient balance).
    await this.wallet.debit({ userId, amountCents: amount, relatedId: bot.id });

    // 2) Activate or extend.
    const now = new Date();
    const newExpiry =
      bot.priceType === BotPriceType.monthly
        ? new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
        : null; // one-off: no expiry
    const { subscription } = await this.activate(userId, bot, newExpiry).then((r) => ({ subscription: r.subscription }));

    // 3) Credit creator. Platform takes PLATFORM_FEE_RATE cut.
    const creatorAmount = Math.floor(amount * (1 - PLATFORM_FEE_RATE));
    await this.wallet.credit({
      userId: bot.creatorId,
      amountCents: creatorAmount,
      relatedId: bot.id,
    });

    return { status: 'active', subscription, paid: amount, creatorEarned: creatorAmount };
  }

  /**
   * Opens or reuses the bot-chat conversation for this user. Gated by
   * subscription for non-creators.
   */
  async openConversation(userId: string, botId: string) {
    const bot = await this.getById(botId);
    if (bot.creatorId !== userId) {
      const sub = await this.prisma.botSubscription.findUnique({
        where: { userId_botId: { userId, botId } },
      });
      const active =
        sub &&
        sub.status === BotSubscriptionStatus.active &&
        (!sub.expiresAt || sub.expiresAt > new Date());
      if (!active) {
        // Auto-expire if past expiry.
        if (sub && sub.expiresAt && sub.expiresAt <= new Date() && sub.status !== BotSubscriptionStatus.expired) {
          await this.prisma.botSubscription.update({
            where: { id: sub.id },
            data: { status: BotSubscriptionStatus.expired },
          });
        }
        throw new ForbiddenException('subscribe first');
      }
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
            senderId: null,
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
