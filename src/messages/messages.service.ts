import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MessagesService {
  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2
  ) {}

  async getConversation(userId: string, otherUserId: string) {
    return this.prisma.message.findMany({
      where: {
        OR: [
          { senderId: userId, receiverId: otherUserId },
          { senderId: otherUserId, receiverId: userId },
        ],
      },
      orderBy: { createdAt: 'asc' },
      include: {
        sender: { select: { id: true, email: true, avatarUrl: true, avatarPosition: true, isOnline: true } },
        reactions: true,
      },
    });
  }

  async getRecentChats(userId: string) {
    const chatPartners = new Map();

    // 1. Get unread counts
    const unreadCounts = await this.prisma.message.groupBy({
      by: ['senderId'],
      where: {
        receiverId: userId,
        isRead: false,
      },
      _count: true,
    });
    const unreadMap = new Map(unreadCounts.map(c => [c.senderId, c._count]));

    // 2. Get recent messages (both sent and received)
    const messages = await this.prisma.message.findMany({
      where: {
        OR: [{ senderId: userId }, { receiverId: userId }],
      },
      orderBy: { createdAt: 'desc' },
      include: {
        sender: { select: { id: true, email: true, name: true, avatarUrl: true, avatarPosition: true, isOnline: true, lastSeen: true } },
        receiver: { select: { id: true, email: true, name: true, avatarUrl: true, avatarPosition: true, isOnline: true, lastSeen: true } },
      },
    });

    messages.forEach((msg) => {
      // Determine who the other person is
      const partner = msg.senderId === userId ? msg.receiver : msg.sender;
      if (!partner) return;

      if (!chatPartners.has(partner.id)) {
        chatPartners.set(partner.id, {
          ...partner,
          lastMessage: msg.content,
          lastTimestamp: msg.createdAt,
          unreadCount: unreadMap.get(partner.id) || 0,
        });
      }
    });

    return Array.from(chatPartners.values()).sort((a: any, b: any) => {
        const timeA = a.lastTimestamp ? new Date(a.lastTimestamp).getTime() : 0;
        const timeB = b.lastTimestamp ? new Date(b.lastTimestamp).getTime() : 0;
        return timeB - timeA;
    });
  }

  async getUnreadCount(userId: string) {
    return this.prisma.message.count({
      where: {
        receiverId: userId,
        isRead: false,
      },
    });
  }

  async markAsRead(userId: string, senderId: string) {
    const result = await this.prisma.message.updateMany({
      where: {
        senderId,
        receiverId: userId,
        isRead: false,
      },
      data: { isRead: true },
    });
    
    this.eventEmitter.emit('messages.read', { senderId, readerId: userId });
    return result;
  }

   async remove(id: string, userId: string, userRole: string = 'USER') {
    const message = await this.prisma.message.findUnique({
      where: { id },
    });

    if (!message) throw new Error('Message not found');

    // Only sender or admin can delete
    if (message.senderId !== userId && userRole !== 'ADMIN') {
      throw new Error('You are not authorized to delete this message');
    }

    return this.prisma.message.delete({ where: { id } });
  }

  async deleteConversation(userId: string, otherUserId: string) {
    const result = await this.prisma.message.deleteMany({
      where: {
        OR: [
          { senderId: userId, receiverId: otherUserId },
          { senderId: otherUserId, receiverId: userId },
        ],
      },
    });
    
    // Also notify both clients to update their UI
    this.eventEmitter.emit('conversation.deleted', { userId, otherUserId });
    
    return { success: true, count: result.count };
  }

  // Admin Surveillance
  async getAllConversations() {
      // Get all unique pairs of users who have exchanged messages, sorted by latest
      const messages = await this.prisma.message.findMany({
          orderBy: { createdAt: 'desc' },
          distinct: ['senderId', 'receiverId'],
          include: {
              sender: { select: { id: true, email: true, name: true, avatarUrl: true } },
              receiver: { select: { id: true, email: true, name: true, avatarUrl: true } }
          }
      });

      const processedPairs = new Set();
      const conversations: any[] = [];

      for (const msg of messages) {
          const pairId = [msg.senderId, msg.receiverId].sort().join('-');
          if (!processedPairs.has(pairId)) {
              processedPairs.add(pairId);
              conversations.push({
                  user1: msg.sender,
                  user2: msg.receiver,
                  lastMessageAt: msg.createdAt,
                  lastMessage: msg.content
              });
          }
      }

      // Sort conversations by latest message overall
      return conversations.sort((a, b) => 
        new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
      );
  }
  async createMessage(senderId: string, data: { receiverId: string, content?: string, messageType?: string, fileUrl?: string, fileName?: string, tempId?: string }) {
    const message = await this.prisma.message.create({
      data: {
        senderId,
        receiverId: data.receiverId,
        content: data.content,
        messageType: data.messageType || 'text',
        fileUrl: data.fileUrl,
        fileName: data.fileName,
      },
      include: {
        sender: { select: { id: true, email: true, avatarUrl: true, isOnline: true } }
      }
    });


    const messageData = JSON.parse(JSON.stringify(message));
    const messageWithTemp = { ...messageData, tempId: data.tempId };
    
    this.eventEmitter.emit('message.created', messageWithTemp);
    return messageWithTemp;
  }

  async getSharedMedia(userId: string, otherUserId: string, types: string[]) {
    return this.prisma.message.findMany({
      where: {
        OR: [
          { senderId: userId, receiverId: otherUserId },
          { senderId: otherUserId, receiverId: userId },
        ],
        messageType: { in: types },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
