import { BadRequestException, Injectable } from '@nestjs/common';
import { TransactionStatus, TransactionType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Money operations are written via Prisma interactive transactions so
 * balance changes + transaction log + downstream side effects (e.g.
 * subscription creation) commit atomically. Amounts are integer cents to
 * avoid float drift.
 */
@Injectable()
export class WalletService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrCreate(userId: string) {
    return this.prisma.wallet.upsert({
      where: { userId },
      update: {},
      create: { userId, balanceCents: 0, currency: 'USD' },
    });
  }

  async balance(userId: string) {
    const w = await this.getOrCreate(userId);
    return { balanceCents: w.balanceCents, currency: w.currency };
  }

  /**
   * MVP-only credit endpoint. In production this is the success branch of
   * Apple/Google IAP receipt validation or Stripe webhook.
   */
  async devRecharge(userId: string, amountCents: number, externalOrderId?: string) {
    if (amountCents <= 0) throw new BadRequestException('amount must be > 0');
    await this.getOrCreate(userId);
    return this.prisma.$transaction(async (tx) => {
      const w = await tx.wallet.update({
        where: { userId },
        data: { balanceCents: { increment: amountCents } },
      });
      const txn = await tx.transaction.create({
        data: {
          userId,
          type: TransactionType.recharge,
          amountCents,
          currency: w.currency,
          status: TransactionStatus.succeeded,
          externalOrderId,
        },
      });
      return { wallet: w, transaction: txn };
    });
  }

  /**
   * Atomically debits the wallet. Throws if balance is insufficient. The
   * caller passes a related id (e.g. botId or subscriptionId) so the
   * transaction row is auditable.
   */
  async debit(args: { userId: string; amountCents: number; relatedId?: string }) {
    if (args.amountCents <= 0) throw new BadRequestException('amount must be > 0');
    await this.getOrCreate(args.userId);
    return this.prisma.$transaction(async (tx) => {
      const w = await tx.wallet.findUnique({ where: { userId: args.userId } });
      if (!w) throw new BadRequestException('wallet missing');
      if (w.balanceCents < args.amountCents) {
        throw new BadRequestException('insufficient balance');
      }
      const updated = await tx.wallet.update({
        where: { userId: args.userId },
        data: { balanceCents: { decrement: args.amountCents } },
      });
      const txn = await tx.transaction.create({
        data: {
          userId: args.userId,
          type: TransactionType.consume,
          amountCents: args.amountCents,
          currency: w.currency,
          relatedId: args.relatedId,
          status: TransactionStatus.succeeded,
        },
      });
      return { wallet: updated, transaction: txn };
    });
  }

  /**
   * Credits a creator's wallet when one of their bots earns revenue.
   */
  async credit(args: { userId: string; amountCents: number; relatedId?: string }) {
    await this.getOrCreate(args.userId);
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.wallet.update({
        where: { userId: args.userId },
        data: { balanceCents: { increment: args.amountCents } },
      });
      const txn = await tx.transaction.create({
        data: {
          userId: args.userId,
          type: TransactionType.income,
          amountCents: args.amountCents,
          currency: updated.currency,
          relatedId: args.relatedId,
          status: TransactionStatus.succeeded,
        },
      });
      return { wallet: updated, transaction: txn };
    });
  }

  /**
   * Credits from a verified external order (IAP/Stripe). Idempotent on
   * `externalOrderId` — replaying the same receipt returns the prior
   * transaction without double-crediting. The (transaction.externalOrderId)
   * column isn't a DB unique constraint today; we enforce uniqueness inside
   * an interactive transaction with a re-check to close the race.
   */
  async creditFromExternalOrder(args: {
    userId: string;
    amountCents: number;
    externalOrderId: string;
    type?: TransactionType;
  }) {
    if (args.amountCents <= 0) throw new BadRequestException('amount must be > 0');
    if (!args.externalOrderId) throw new BadRequestException('externalOrderId required');

    // Fast path: already credited.
    const prior = await this.prisma.transaction.findFirst({
      where: { externalOrderId: args.externalOrderId },
    });
    if (prior) {
      const w = await this.getOrCreate(args.userId);
      return { wallet: w, transaction: prior, idempotent: true };
    }

    await this.getOrCreate(args.userId);
    return this.prisma.$transaction(async (tx) => {
      const racing = await tx.transaction.findFirst({
        where: { externalOrderId: args.externalOrderId },
      });
      if (racing) {
        const w = await tx.wallet.findUnique({ where: { userId: args.userId } });
        return { wallet: w!, transaction: racing, idempotent: true };
      }
      const w = await tx.wallet.update({
        where: { userId: args.userId },
        data: { balanceCents: { increment: args.amountCents } },
      });
      const txn = await tx.transaction.create({
        data: {
          userId: args.userId,
          type: args.type ?? TransactionType.recharge,
          amountCents: args.amountCents,
          currency: w.currency,
          externalOrderId: args.externalOrderId,
          status: TransactionStatus.succeeded,
        },
      });
      return { wallet: w, transaction: txn, idempotent: false };
    });
  }

  async listTransactions(userId: string, limit = 50) {
    return this.prisma.transaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 200),
    });
  }
}
