import { Module } from '@nestjs/common';
import { CloudinaryService } from '../common/cloudinary.service';
import { PrismaService } from '../prisma/prisma.service';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';
import { PublicPostsController } from './public-posts.controller';

@Module({
  controllers: [PostsController, PublicPostsController],
  providers: [PostsService, PrismaService, CloudinaryService],
})
export class PostsModule {}
