
import {
    ConnectedSocket,
    MessageBody,
    OnGatewayConnection,
    OnGatewayDisconnect,
    SubscribeMessage,
    WebSocketGateway,
    WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private connectedUsers = new Map<string, string>(); // userId -> socketId

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  async handleConnection(client: Socket) {
    const userId = client.handshake.query.userId as string;
    if (userId) {
      this.connectedUsers.set(userId, client.id);
      client.join(`user_${userId}`); // Join user-specific room
      await this.prisma.user.update({
        where: { id: userId },
        data: { isOnline: true, lastSeen: new Date() },
      });
      this.server.emit('userStatusChanged', { userId, isOnline: true });
      console.log(`User connected: ${userId} with socket ${client.id}`);
    }
  }

  async handleDisconnect(client: Socket) {
    for (const [userId, socketId] of this.connectedUsers.entries()) {
      if (socketId === client.id) {
        this.connectedUsers.delete(userId);
        await this.prisma.user.update({
          where: { id: userId },
          data: { isOnline: false, lastSeen: new Date() },
        });
        this.server.emit('userStatusChanged', { userId, isOnline: false });
        console.log(`User disconnected: ${userId}`);
        break;
      }
    }
  }

  @SubscribeMessage('sendMessage')
  async handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { receiverId: string; content: string; senderId: string },
  ) {
    const { receiverId, content, senderId } = data;

    // Save message to DB
    const message = await this.prisma.message.create({
      data: {
        content,
        senderId,
        receiverId,
      },
      include: {
        sender: { select: { email: true, avatarUrl: true, avatarPosition: true } },
      },
    });

    // Send to receiver room (all tabs)
    this.server.to(`user_${receiverId}`).emit('newMessage', message);

    // Also notify about new message
    await this.notifications.create({
        type: 'MESSAGE',
        message: `New message from ${message.sender.email.split('@')[0]}`,
        userId: receiverId,
        data: { senderId },
    });

    return message;
  }

  @SubscribeMessage('reactToMessage')
  async handleReaction(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { messageId: string; type: string; userId: string; receiverId: string },
  ) {
    const { messageId, type, userId, receiverId } = data;

    const reaction = await this.prisma.messageReaction.upsert({
      where: {
        userId_messageId: {
          userId,
          messageId,
        },
      },
      update: { type },
      create: {
        userId,
        messageId,
        type,
      },
    });

    // Notify receiver room
    this.server.to(`user_${receiverId}`).emit('messageReaction', { messageId, reaction, senderId: userId });

    return reaction;
  }

  @SubscribeMessage('markAsRead')
  async handleMarkAsRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { senderId: string; userId: string },
  ) {
    const { senderId, userId } = data;

    await this.prisma.message.updateMany({
      where: {
        senderId,
        receiverId: userId,
        isRead: false,
      },
      data: { isRead: true },
    });

    // Notify original sender room
    this.server.to(`user_${senderId}`).emit('messagesRead', { readerId: userId });
  }

  @SubscribeMessage('deleteMessage')
  async handleDeleteMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { messageId: string; userId: string; receiverId: string },
  ) {
    const { messageId, userId, receiverId } = data;

    // Check ownership and delete
    const message = await this.prisma.message.findUnique({ where: { id: messageId } });
    if (message && message.senderId === userId) {
      await this.prisma.message.delete({ where: { id: messageId } });
      
      // Notify both sender and receiver
      this.server.to(`user_${userId}`).emit('messageDeleted', { messageId });
      this.server.to(`user_${receiverId}`).emit('messageDeleted', { messageId });
    }
  }
}
