
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'event', level: 'error' },
        { emit: 'event', level: 'info' },
        { emit: 'event', level: 'warn' },
      ],
    });
  }

  async onModuleInit() {
    await this.$connect();

    // @ts-ignore
    this.$on('query', (e: any) => {
    });

    // @ts-ignore
    this.$on('error', (e: any) => {
      this.logger.error(`Error: ${e.message}`);
    });

    // @ts-ignore
    this.$on('warn', (e: any) => {
    });

    // @ts-ignore
    this.$on('info', (e: any) => {
    });

  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
