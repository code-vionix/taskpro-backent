import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ReactionType } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PostsService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  async create(userId: string, createPostDto: any) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (user && !user.canPost && user.role !== 'ADMIN') {
        throw new ForbiddenException('You have been restricted from posting');
    }
    if (user && !user.canUseCommunity && user.role !== 'ADMIN') {
        throw new ForbiddenException('Community access restricted');
    }
    return this.prisma.post.create({
      data: {
        content: createPostDto.content,
        imageUrl: createPostDto.imageUrl,
        userId,
        sharedPostId: createPostDto.sharedPostId,
      },
      include: { 
          user: { select: { id: true, email: true, role: true, avatarUrl: true, avatarPosition: true } },
          sharedPost: {
              include: {
                  user: { select: { id: true, email: true, role: true, avatarUrl: true, avatarPosition: true } }
              }
          }
      }
    });
  }

  async sharePost(userId: string, postId: string, content?: string) {
      const originalPost = await this.prisma.post.findUnique({
          where: { id: postId },
          include: { user: true }
      });
      if (!originalPost) throw new NotFoundException('Post not found');

      const sharedPost = await this.prisma.post.create({
          data: {
              content: content || '',
              userId,
              sharedPostId: postId
          },
          include: {
              user: { select: { id: true, email: true, role: true, avatarUrl: true, avatarPosition: true } },
              sharedPost: {
                  include: {
                      user: { select: { id: true, email: true, role: true, avatarUrl: true, avatarPosition: true } }
                  }
              }
          }
      });

      // Notify owner
      if (originalPost.userId !== userId) {
          const sharer = await this.prisma.user.findUnique({ where: { id: userId } });
          await this.notifications.create({
              userId: originalPost.userId,
              type: 'SHARE',
              message: `${sharer?.email.split('@')[0]} shared your post`,
              data: { postId: sharedPost.id }
          });
      }

      return sharedPost;
  }

  async findAll(skip: number = 0, take: number = 10, userId?: string, onlyFollowing: boolean = false) {
    let where = {};
    
    if (onlyFollowing && userId) {
        const following = await this.prisma.follow.findMany({
            where: { followerId: userId },
            select: { followingId: true }
        });
        const followingIds = following.map(f => f.followingId);
        where = { userId: { in: followingIds } };
    }

    return this.prisma.post.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, email: true, role: true, avatarUrl: true, avatarPosition: true } },
        _count: { select: { comments: true, shares: true } },
        reactions: {
          include: {
            user: { select: { id: true, email: true, avatarUrl: true } }
          }
        },
        sharedPost: {
            include: {
                user: { select: { id: true, email: true, role: true, avatarUrl: true, avatarPosition: true } }
            }
        },
        comments: {
           include: { 
               user: { select: { id: true, email: true, avatarUrl: true } },
           },
           orderBy: { createdAt: 'asc' },
        }
      },
    });
  }

  async findByUser(userId: string, skip: number = 0, take: number = 10) {
      return this.prisma.post.findMany({
          where: { userId },
          skip,
          take,
          orderBy: { createdAt: 'desc' },
          include: {
              user: { select: { id: true, email: true, role: true, avatarUrl: true, avatarPosition: true } },
              _count: { select: { comments: true, shares: true } },
              reactions: {
                  include: {
                      user: { select: { id: true, email: true, avatarUrl: true } }
                  }
              },
              sharedPost: {
                  include: {
                      user: { select: { id: true, email: true, role: true, avatarUrl: true, avatarPosition: true } }
                  }
              },
              comments: {
                  include: { 
                      user: { select: { id: true, email: true, avatarUrl: true } },
                  },
                  orderBy: { createdAt: 'asc' },
              }
          },
      });
  }

  async findOne(id: string) {
    const post = await this.prisma.post.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, email: true, avatarUrl: true, avatarPosition: true } },
        sharedPost: {
            include: {
                user: { select: { id: true, email: true, avatarUrl: true, avatarPosition: true } }
            }
        },
        comments: { 
            include: { 
                user: { select: { id: true, email: true, avatarUrl: true } } 
            } 
        },
        reactions: true
      }
    });
    if (!post) throw new NotFoundException('Post not found');
    return post;
  }

  async addReaction(userId: string, postId: string, type: ReactionType) {
      // Find post to get owner and info
      const post = await this.prisma.post.findUnique({
          where: { id: postId },
          include: { user: true }
      });
      if (!post) throw new NotFoundException('Post not found');

      // Check if reaction exists
      const existing = await this.prisma.reaction.findUnique({
          where: { userId_postId: { userId, postId } }
      });

      let result;
      if (existing) {
          if (existing.type === type) {
              // Toggle off
              result = await this.prisma.reaction.delete({ where: { id: existing.id } });
          } else {
              // Update type
              result = await this.prisma.reaction.update({
                  where: { id: existing.id },
                  data: { type }
              });
          }
      } else {
          result = await this.prisma.reaction.create({ data: { userId, postId, type } });
          
          // Notify owner if it's not their own post
          if (post.userId !== userId) {
             const sender = await this.prisma.user.findUnique({ where: { id: userId } });
             await this.notifications.create({
                 userId: post.userId,
                 type: 'REACTION',
                 message: `${sender?.email.split('@')[0]} liked your post`,
                 data: { postId }
             });
          }
      }

      return result;
  }

  async addComment(userId: string, postId: string, content: string, parentId?: string) {
      const comment = await this.prisma.comment.create({
          data: { content, userId, postId, parentId },
          include: { 
              user: { select: { id: true, email: true, name: true, avatarUrl: true } },
              post: { include: { user: true } }
          }
      });

      // Notify post owner
      if (comment.post.userId !== userId) {
          await this.notifications.create({
              userId: comment.post.userId,
              type: 'COMMENT',
              message: `${comment.user.email.split('@')[0]} commented on your post`,
              data: { postId, commentId: comment.id }
          });
      }

      return comment;
  }

  async updateComment(userId: string, commentId: string, content: string) {
      const comment = await this.prisma.comment.findUnique({
          where: { id: commentId }
      });
      if (!comment) throw new NotFoundException('Comment not found');
      if (comment.userId !== userId) throw new ForbiddenException('Not authorized');

      return this.prisma.comment.update({
          where: { id: commentId },
          data: { content },
          include: { user: { select: { id: true, email: true, name: true, avatarUrl: true } } }
      });
  }

  async deleteComment(userId: string, commentId: string, role: string) {
      const comment = await this.prisma.comment.findUnique({
          where: { id: commentId }
      });
      if (!comment) throw new NotFoundException('Comment not found');
      if (comment.userId !== userId && role !== 'ADMIN') throw new ForbiddenException('Not authorized');

      return this.prisma.comment.delete({
          where: { id: commentId }
      });
  }

  async update(id: string, userId: string, updatePostDto: any) {
    const post = await this.prisma.post.findUnique({
      where: { id },
      include: { user: true }
    });

    if (!post) throw new NotFoundException('Post not found');
    
    // Only owner can update
    if (post.userId !== userId) {
      throw new Error('You are not authorized to update this post');
    }

    return this.prisma.post.update({
      where: { id },
      data: {
        content: updatePostDto.content,
        imageUrl: updatePostDto.imageUrl,
      },
      include: { user: { select: { id: true, email: true, role: true } } }
    });
  }

  async remove(id: string, userId: string, userRole: string) {
    const post = await this.prisma.post.findUnique({
      where: { id },
    });

    if (!post) throw new NotFoundException('Post not found');

    // Only owner or admin can delete
    if (post.userId !== userId && userRole !== 'ADMIN') {
      throw new Error('You are not authorized to delete this post');
    }

    return this.prisma.post.delete({ where: { id } });
  }
}
