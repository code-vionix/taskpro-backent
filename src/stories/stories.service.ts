import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StoriesService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, imageUrl: string) {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // Stories last 24h

    return this.prisma.story.create({
      data: {
        imageUrl,
        userId,
        expiresAt,
      },
      include: {
        user: { select: { id: true, email: true, avatarUrl: true } },
      },
    });
  }

  async findAll() {
    const now = new Date();
    return this.prisma.story.findMany({
      where: {
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, email: true, avatarUrl: true } },
      },
    });
  }

  async remove(id: string, userId: string, userRole: string) {
    const story = await this.prisma.story.findUnique({
      where: { id },
    });

    if (!story) throw new NotFoundException('Story not found');

    if (story.userId !== userId && userRole !== 'ADMIN') {
      throw new ForbiddenException('Unauthorized to delete this story');
    }

    return this.prisma.story.delete({ where: { id } });
  }
}
