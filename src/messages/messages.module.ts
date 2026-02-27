import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';
import { CloudinaryService } from '../common/cloudinary.service';

@Module({
  controllers: [MessagesController],
  providers: [MessagesService, PrismaService, CloudinaryService],
})
export class MessagesModule {}
