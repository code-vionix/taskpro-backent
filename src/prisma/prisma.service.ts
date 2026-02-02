
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
      console.log(`\x1b[36m[Prisma Query]\x1b[0m ${e.query} - \x1b[33m${e.duration}ms\x1b[0m`);
    });

    // @ts-ignore
    this.$on('error', (e: any) => {
      this.logger.error(`Error: ${e.message}`);
    });

    // @ts-ignore
    this.$on('warn', (e: any) => {
      console.warn(`\x1b[33m[Prisma Warn]\x1b[0m ${e.message}`);
    });

    // @ts-ignore
    this.$on('info', (e: any) => {
      console.log(`\x1b[34m[Prisma Info]\x1b[0m ${e.message}`);
    });

  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}

