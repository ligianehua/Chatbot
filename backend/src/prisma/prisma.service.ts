import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Prisma connected to database');
    } catch (e) {
      this.logger.warn(`Prisma connect failed; continuing so /health can report db: down. ${e instanceof Error ? e.message : e}`);
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
