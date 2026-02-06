
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
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
        category: true,
        lastCategoryUpdate: true,
        _count: {
          select: {
            posts: true,
            tasks: true,
            followers: true,
            following: true,
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

  async updateCategory(userId: string, category: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { lastCategoryUpdate: true }
    });

    if (user?.lastCategoryUpdate) {
      const lastUpdate = new Date(user.lastCategoryUpdate);
      const now = new Date();
      const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;
      
      if (now.getTime() - lastUpdate.getTime() < thirtyDaysInMs) {
        const daysRemaining = Math.ceil((thirtyDaysInMs - (now.getTime() - lastUpdate.getTime())) / (1000 * 60 * 60 * 24));
        throw new BadRequestException(`Category change restricted. ${daysRemaining} days remaining in cooldown.`);
      }
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { 
        category,
        lastCategoryUpdate: new Date()
      }
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
        category: true
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async remove(id: string) {
      return this.prisma.user.delete({
          where: { id }
      });
  }

  async follow(followerId: string, followingId: string) {
    if (followerId === followingId) throw new BadRequestException('Cannot follow yourself');
    
    const exists = await this.prisma.follow.findUnique({
      where: { followerId_followingId: { followerId, followingId } }
    });
    
    if (exists) return exists;

    return this.prisma.follow.create({
      data: { followerId, followingId }
    });
  }

  async unfollow(followerId: string, followingId: string) {
    return this.prisma.follow.delete({
      where: { followerId_followingId: { followerId, followingId } }
    });
  }

  async getFollowers(userId: string) {
    return this.prisma.follow.findMany({
      where: { followingId: userId },
      include: { follower: { select: { id: true, name: true, email: true, avatarUrl: true } } }
    });
  }

  async getFollowing(userId: string) {
    return this.prisma.follow.findMany({
      where: { followerId: userId },
      include: { following: { select: { id: true, name: true, email: true, avatarUrl: true } } }
    });
  }
}
