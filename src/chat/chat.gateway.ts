
import { OnEvent } from '@nestjs/event-emitter';
import { JwtService } from '@nestjs/jwt';
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
import { MessagesService } from '../messages/messages.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

@WebSocketGateway({
  cors: { origin: '*' },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private connectedUsers = new Map<string, string>(); // userId -> socketId

  constructor(
    private jwtService: JwtService,
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private messagesService: MessagesService,
  ) {}

  // ─── Connection Lifecycle ─────────────────────────────────────────────────────

  async handleConnection(client: Socket) {
    // Support both query (mobile) and auth (web)
    const token = (client.handshake.auth?.token || client.handshake.query?.token) as string;
    const queryUserId = client.handshake.query?.userId as string;

    let userId: string | null = null;

    // Try JWT first
    if (token) {
      try {
        const decoded: any = this.jwtService.verify(token);
        userId = decoded.sub;
      } catch (e) {
        console.warn(`[ChatGateway] JWT verify failed for ${client.id}: ${e.message}`);
      }
    }

    // Fallback: use query userId (only allow if we already trust this socket layer)
    if (!userId && queryUserId) {
      userId = queryUserId;
    }

    if (!userId) {
      console.error(`[ChatGateway] No userId for ${client.id}, disconnecting.`);
      client.disconnect();
      return;
    }

    client['userId'] = userId;
    this.connectedUsers.set(userId, client.id);
    client.join(`user_${userId}`);

    await this.prisma.user.update({
      where: { id: userId },
      data: { isOnline: true, lastSeen: new Date() },
    });
    this.server.emit('userStatusChanged', { userId, isOnline: true });
    console.log(`[ChatGateway] Connected: ${userId} (${client.id})`);
  }

  async handleDisconnect(client: Socket) {
    const userId = client['userId'];
    if (!userId) return;

    this.connectedUsers.delete(userId);
    await this.prisma.user.update({
      where: { id: userId },
      data: { isOnline: false, lastSeen: new Date() },
    }).catch(() => {}); // ignore if user deleted
    this.server.emit('userStatusChanged', { userId, isOnline: false });
    console.log(`[ChatGateway] Disconnected: ${userId}`);
  }

  // ─── Event Listeners (Internal) ───────────────────────────────────────────────

  @OnEvent('message.created')
  handleMessageCreated(message: any) {
    const { receiverId, senderId } = message;
    this.server.to(`user_${receiverId}`).emit('newMessage', message);
    if (receiverId !== senderId) {
      this.server.to(`user_${senderId}`).emit('newMessage', message);
    }
    console.log(`[ChatGateway] newMessage dispatched: ${senderId} → ${receiverId}`);
  }

  @OnEvent('messages.read')
  handleMessagesRead(payload: { senderId: string; readerId: string }) {
    this.server.to(`user_${payload.senderId}`).emit('messagesRead', { readerId: payload.readerId });
  }

  @OnEvent('conversation.deleted')
  handleConversationDeleted(payload: { userId: string; otherUserId: string }) {
    this.server.to(`user_${payload.userId}`).emit('conversationDeleted', { otherUserId: payload.otherUserId });
    this.server.to(`user_${payload.otherUserId}`).emit('conversationDeleted', { otherUserId: payload.userId });
    console.log(`[ChatGateway] conversationDeleted dispatched: ${payload.userId} & ${payload.otherUserId}`);
  }

  // ─── Chat Events ──────────────────────────────────────────────────────────────

  @SubscribeMessage('sendMessage')
  async handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { receiverId: string; content: string; senderId: string; tempId?: string },
  ) {
    const { receiverId, content, senderId, tempId } = data;
    const sender = await this.prisma.user.findUnique({ where: { id: senderId } });

    if (sender && !sender.canMessage && sender.role !== 'ADMIN') {
      client.emit('error', { message: 'You are restricted from sending messages' });
      return;
    }
    if (sender && !sender.canUseCommunity && sender.role !== 'ADMIN') {
      client.emit('error', { message: 'Community access restricted' });
      return;
    }
    return this.messagesService.createMessage(senderId, { receiverId, content, tempId });
  }

  @SubscribeMessage('reactToMessage')
  async handleReaction(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { messageId: string; type: string; userId: string; receiverId: string },
  ) {
    const { messageId, type, userId, receiverId } = data;
    const reaction = await this.prisma.messageReaction.upsert({
      where: { userId_messageId: { userId, messageId } },
      update: { type },
      create: { userId, messageId, type },
    });
    this.server.to(`user_${receiverId}`).emit('messageReaction', { messageId, reaction, senderId: userId });
    return reaction;
  }

  @SubscribeMessage('markAsRead')
  @SubscribeMessage('readMessage')
  async handleMarkAsRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { senderId: string; userId: string },
  ) {
    return this.messagesService.markAsRead(data.userId, data.senderId);
  }

  @SubscribeMessage('deleteMessage')
  async handleDeleteMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { messageId: string; userId: string; receiverId: string },
  ) {
    const { messageId, userId } = data;
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: { sender: true },
    });
    const requestor = await this.prisma.user.findUnique({ where: { id: userId } });
    const isAdmin = requestor?.role === 'ADMIN';

    if (message && (message.senderId === userId || isAdmin)) {
      await this.prisma.message.delete({ where: { id: messageId } });
      this.server.to(`user_${message.senderId}`).emit('messageDeleted', { messageId });
      this.server.to(`user_${message.receiverId}`).emit('messageDeleted', { messageId });
    }
  }

  @SubscribeMessage('typing')
  handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { receiverId: string; senderId: string },
  ) {
    this.server.to(`user_${data.receiverId}`).emit('typing', { senderId: data.senderId });
  }

  @SubscribeMessage('stopTyping')
  handleStopTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { receiverId: string; senderId: string },
  ) {
    this.server.to(`user_${data.receiverId}`).emit('stopTyping', { senderId: data.senderId });
  }

  // ─── Calling Feature ──────────────────────────────────────────────────────────

  @SubscribeMessage('initiateCall')
  handleInitiateCall(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { receiverId: string; senderId: string; senderName: string; senderAvatar?: string; isVideo: boolean },
  ) {
    const senderId = client['userId'] || data.senderId;
    console.log(`[Call] 📞 Initiate: ${senderId} → ${data.receiverId} (video=${data.isVideo})`);

    this.server.to(`user_${data.receiverId}`).emit('incomingCall', {
      senderId,
      receiverId: data.receiverId,
      senderName: data.senderName,
      senderAvatar: data.senderAvatar || '',
      isVideo: data.isVideo,
    });
  }

  @SubscribeMessage('answerCall')
  handleAnswerCall(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { callerId: string; receiverId: string },
  ) {
    console.log(`[Call] ✅ Accepted: ${data.receiverId} answered ${data.callerId}`);
    this.server.to(`user_${data.callerId}`).emit('callAccepted', {
      callerId: data.callerId,
      receiverId: data.receiverId,
    });
  }

  @SubscribeMessage('rejectCall')
  handleRejectCall(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { callerId: string; receiverId: string; reason?: string },
  ) {
    console.log(`[Call] ❌ Rejected: ${data.receiverId} rejected ${data.callerId}`);
    this.server.to(`user_${data.callerId}`).emit('callRejected', {
      callerId: data.callerId,
      receiverId: data.receiverId,
      reason: data.reason || 'declined',
    });
  }

  @SubscribeMessage('call:signal')
  handleCallSignal(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { targetId: string; signal: any },
  ) {
    const senderId = client['userId'];
    // Relay WebRTC signaling data (SDP offer/answer, ICE candidates)
    this.server.to(`user_${data.targetId}`).emit('call:signal', {
      senderId,
      signal: data.signal,
    });
  }

  @SubscribeMessage('endCall')
  handleEndCall(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { targetId: string },
  ) {
    const senderId = client['userId'];
    console.log(`[Call] 📵 Ended: ${senderId} ended call with ${data.targetId}`);
    this.server.to(`user_${data.targetId}`).emit('callEnded', {
      fromId: senderId,
    });
  }
}
