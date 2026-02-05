
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(data: any) {
    return this.prisma.user.create({
      data,
    });
  }

  async findOne(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async findOneById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  async findProfile(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        bio: true,
        address: true,
        education: true,
        avatarUrl: true,
        coverImageUrl: true,
        coverPosition: true,
        avatarPosition: true,
        isOnline: true,
        lastSeen: true,
        createdAt: true,
        canPost: true,
        canMessage: true,
        canUseCommunity: true,
        canCreateTask: true,
        _count: {
          select: {
            posts: true,
            tasks: true,
          },
        },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async update(id: string, data: any) {
    return this.prisma.user.update({
      where: { id },
      data,
    });
  }

  async updateRefreshToken(id: string, refreshToken: string | null) {
    return this.prisma.user.update({
      where: { id },
      data: { refreshToken },
    });
  }

   async findAll() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatarUrl: true,
        isOnline: true,
        canPost: true,
        canMessage: true,
        canUseCommunity: true,
        canCreateTask: true,
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async remove(id: string) {
      return this.prisma.user.delete({
          where: { id }
      });
  }
}
