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
import { PrismaService } from '../prisma/prisma.service';
import { RemoteControlService } from './remote-control.service';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  maxHttpBufferSize: 1e8, // 100 MB for large payloads (images)
  namespace: 'remote-control',
})
export class RemoteControlGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly remoteControlService: RemoteControlService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async handleConnection(client: Socket) {
    const authHeader = client.handshake.auth?.token;
    const queryToken = client.handshake.query?.token;
    console.log(`[Socket] Auth check: id=${client.id}, authTok=${!!authHeader}, queryTok=${!!queryToken}`);
    
    try {
      const token = (authHeader || queryToken) as string;
      
      if (!token) {
        console.error(`[Socket] Client ${client.id} disconnected: No token provided in handshake`);
        client.disconnect();
        return;
      }

      const decoded: any = this.jwtService.verify(token);
      const userId = decoded.sub;
      client['userId'] = userId;

      // Join user room for cross-device notification/sync
      client.join(`user_${userId}`);

      console.log(`[Socket] Authenticated: ${client.id} (User: ${client['userId']})`);
    } catch (error) {
      console.error(`[Socket] Client ${client.id} auth failed: ${error.message}`);
      client.disconnect();
    }
  }

  @SubscribeMessage('updatePresence')
  async handleUpdatePresence(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { isOnline: boolean },
  ) {
    const userId = client['userId'];
    if (userId) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { isOnline: data.isOnline, lastSeen: new Date() },
      });
      this.server.emit('userStatusChanged', { userId, isOnline: data.isOnline });
      console.log(`User presence updated: ${userId} -> ${data.isOnline}`);
    }
  }

  async handleDisconnect(client: Socket) {
    const userId = client['userId'];
    if (userId) {
        await this.prisma.user.update({
            where: { id: userId },
            data: { isOnline: false, lastSeen: new Date() },
        });
        this.server.emit('userStatusChanged', { userId, isOnline: false });
    }
    console.log(`Client disconnected: ${client.id}`);
    await this.remoteControlService.handleDeviceDisconnect(client.id);
  }

  // Mobile app registers device
  @SubscribeMessage('device:register')
  async handleDeviceRegister(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: any,
  ) {
    try {
      // Use the authenticated userId from the socket
      const userId = client['userId'];
      if (!userId) {
        throw new Error('User not authenticated');
      }

      const device = await this.remoteControlService.registerDevice(
        userId,
        data.deviceInfo,
        client.id,
      );
      
      // Join device-specific room
      client.join(`device:${device.id}`);
      
      return {
        success: true,
        device,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Web client requests to connect to a device
  @SubscribeMessage('session:start')
  async handleSessionStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { deviceId: string },
  ) {
    try {
      const userId = client['userId'];
      if (!userId) {
        throw new Error('User not authenticated');
      }

      const session = await this.remoteControlService.startSession(
        data.deviceId,
        client.id,
        userId,
      );

      // Join session room
      client.join(`session:${session.id}`);

      // Notify mobile device
      this.server.to(`device:${data.deviceId}`).emit('session:request', {
        sessionId: session.id,
        webClientId: client.id,
      });

      return {
        success: true,
        session,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Mobile device accepts/rejects session
  @SubscribeMessage('session:response')
  async handleSessionResponse(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string; accepted: boolean },
  ) {
    try {
      const session = await this.remoteControlService.getSession(data.sessionId);
      if (!session) return { success: false, error: 'Session not found' };

      // Verify ownership: mobile device must be owned by the user in the session
      const device = await this.remoteControlService.getDevice(session.deviceId);
      if (device?.userId !== client['userId']) {
        console.error('[Session] Unauthorized response by user:', client['userId']);
        return { success: false, error: 'Unauthorized' };
      }

      await this.remoteControlService.updateSessionStatus(
        data.sessionId,
        data.accepted,
      );

      // Notify web client
      this.server.to(`session:${data.sessionId}`).emit('session:status', {
        accepted: data.accepted,
        session,
      });

      return { success: true };
    } catch (error) {
       return { success: false, error: error.message };
    }
  }

  // Web client sends command to device
  @SubscribeMessage('command:send')
  async handleCommandSend(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      sessionId: string;
      type: string;
      payload?: any;
    },
  ) {
    try {
      const session = await this.remoteControlService.getSession(
        data.sessionId,
      );
      if (!session) {
        throw new Error('Session not found');
      }

      // Check ownership
      const device = await this.remoteControlService.getDevice(session.deviceId);
      if (device?.userId !== client['userId']) {
        throw new Error('Unauthorized: You do not own this device/session');
      }

      const command = await this.remoteControlService.createCommand(
        data.sessionId,
        data.type,
        data.payload,
      );

      if (session) {
        this.server.to(`device:${session.deviceId}`).emit('command:execute', {
            commandId: command.id,
            type: command.type,
            payload: command.payload,
        });
      }

      return {
        success: true,
        commandId: command.id,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  @SubscribeMessage('command:result')
  async handleCommandResult(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      commandId: string;
      status: string;
      result?: any;
      error?: string;
    },
  ) {
    console.log(`Backend received command:result for ID: ${data.commandId}, Status: ${data.status}`);
    console.log('DEBUG CHECK: Payload keys:', Object.keys(data));
    console.log('DEBUG CHECK: Result type:', typeof data.result);
    if (data.result) {
        const resultStr = typeof data.result === 'string' ? data.result : JSON.stringify(data.result);
        console.log('DEBUG CHECK: Result length:', resultStr.length);
        console.log('DEBUG CHECK: Result start:', resultStr.substring(0, 100));
    }
    
    try {
        const command = await this.remoteControlService.getCommand(data.commandId);
        if (!command) throw new Error('Command not found');

        const session = await this.remoteControlService.getSession(command.sessionId);
        if (!session) throw new Error('Session not found');

        // Check ownership: device sending the result must be owned by the authenticated user
        const device = await this.remoteControlService.getDevice(session.deviceId);
        if (device?.userId !== client['userId']) {
           console.error('[Command] Unauthorized result by user:', client['userId']);
           return { success: false, error: 'Unauthorized' };
        }

        await this.remoteControlService.updateCommandStatus(
          data.commandId,
          data.status,
          data.result,
          data.error,
        );

        // Notify web client
        this.server.to(`session:${command.sessionId}`).emit('command:completed', {
            ...data,
            type: command.type,
        });

        return { success: true };
    } catch (err) {
        console.error(`Backend failed to process result for ${data.commandId}:`, err);
        return { success: false, error: err.message };
    }
  }

  // WebRTC signaling relay
  @SubscribeMessage('webrtc:offer')
  async handleWebRTCOffer(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: any,
  ) {
    console.log('[WebRTC] Received offer from web:', JSON.stringify(data));
    const session = await this.remoteControlService.getSession(data.sessionId);
    
    if (session) {
        // Verify ownership
        const device = await this.remoteControlService.getDevice(session.deviceId);
        if (device?.userId !== client['userId']) {
            console.error('[WebRTC] Unauthorized offer attempt by user:', client['userId']);
            return { success: false, error: 'Unauthorized' };
        }

        console.log('[WebRTC] Forwarding offer to device:', session.deviceId);
        this.server.to(`device:${session.deviceId}`).emit('webrtc:offer', data);
    } else {
        console.error('[WebRTC] Session not found for offer:', data.sessionId);
    }
    return { success: true };
  }

  @SubscribeMessage('webrtc:answer')
  async handleWebRTCAnswer(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string; [key: string]: any },
  ) {
    const session = await this.remoteControlService.getSession(data.sessionId);
    if (session) {
        // Verify ownership
        const device = await this.remoteControlService.getDevice(session.deviceId);
        if (device?.userId !== client['userId']) {
            console.error('[WebRTC] Unauthorized answer by user:', client['userId']);
            return { success: false, error: 'Unauthorized' };
        }
        this.server.to(`session:${data.sessionId}`).emit('webrtc:answer', data);
    }
    return { success: true };
  }

  @SubscribeMessage('webrtc:ice-candidate')
  async handleICECandidate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: any,
  ) {
    const session = await this.remoteControlService.getSession(data.sessionId);
    if (!session) return { success: false, error: 'Session not found' };

    // Verify ownership
    const device = await this.remoteControlService.getDevice(session.deviceId);
    if (device?.userId !== client['userId']) {
        console.error('[WebRTC] Unauthorized ICE candidate by user:', client['userId']);
        return { success: false, error: 'Unauthorized' };
    }

    console.log('[WebRTC] Received ICE candidate:', JSON.stringify(data));
    
    // If target is 'web', route to the session room
    if (data.target === 'web') {
      this.server.to(`session:${data.sessionId}`).emit('webrtc:ice-candidate', data);
    } 
    // If target is 'device' or not specified (default from web client), route to device
    else {
      console.log('[WebRTC] Forwarding ICE to device:', session.deviceId);
      this.server.to(`device:${session.deviceId}`).emit('webrtc:ice-candidate', data);
    }
    return { success: true };
  }

  @SubscribeMessage('notification:receive')
  async handleNotificationReceive(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string; notification: string },
  ) {
    if (!data.sessionId) return;
    
    const session = await this.remoteControlService.getSession(data.sessionId);
    if (session) {
      // Verify device ownership
      const device = await this.remoteControlService.getDevice(session.deviceId);
      if (device?.userId === client['userId']) {
        // Forward to the session room (web client)
        this.server.to(`session:${data.sessionId}`).emit('notification:receive', data);
      }
    }
  }

  // Screen frame streaming (fallback if WebRTC fails)
  @SubscribeMessage('screen:frame')
  async handleScreenFrame(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string; frame: string; type?: string },
  ) {
    // Basic verification: user must own the device in the session to send frames
    const session = await this.remoteControlService.getSession(data.sessionId);
    if (session) {
        const device = await this.remoteControlService.getDevice(session.deviceId);
        if (device?.userId !== client['userId']) {
            // Drop silent to not spam
            return;
        }

        if (data.type !== 'camera') {
            if (Math.random() < 0.01) {
                console.log(`Forwarding screen frame for session: ${data.sessionId}`);
            }
        }
        this.server.to(`session:${data.sessionId}`).emit('screen:frame', {
          frame: data.frame,
          type: data.type,
        });
    }
  }

  // ── Chat Signaling Relay (For Mobile App Compatibility) ─────────────────────
  @SubscribeMessage('sendMessage')
  async handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { receiverId: string; content: string; senderId: string },
  ) {
    const { receiverId, content, senderId } = data;
    const authenticatedUserId = client['userId'];

    // Verify senderId matches authenticated user unless Admin
    // (This is important for security as app provides senderId)
    const sender = await this.prisma.user.findUnique({ where: { id: authenticatedUserId } });
    const isAdmin = sender?.role === 'ADMIN';

    if (!isAdmin && senderId !== authenticatedUserId) {
        client.emit('error', { message: 'Unauthorized sender identity' });
        return;
    }

    if (sender && !sender.canMessage && !isAdmin) {
        client.emit('error', { message: 'You are restricted from sending messages' });
        return;
    }

    // Save message to DB
    const message = await this.prisma.message.create({
      data: {
        content,
        senderId: authenticatedUserId,
        receiverId,
      },
      include: {
        sender: { select: { email: true, avatarUrl: true, avatarPosition: true } },
      },
    });

    // Send to both namespaces to ensure web and app sync
    const namespaces = ['/', '/remote-control'];
    namespaces.forEach(ns => {
        this.server.of(ns).to(`user_${receiverId}`).emit('newMessage', message);
        client.broadcast.to(ns).to(`user_${authenticatedUserId}`).emit('newMessage', message);
    });

    return message;
  }

  @SubscribeMessage('markAsRead')
  async handleMarkAsRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { senderId: string; userId: string },
  ) {
      const authId = client['userId'];
      await this.prisma.message.updateMany({
          where: {
              senderId: data.senderId,
              receiverId: authId,
              isRead: false,
          },
          data: { isRead: true },
      });
      // Notify sender in both namespaces
      const namespaces = ['/', '/remote-control'];
      namespaces.forEach(ns => {
          this.server.of(ns).to(`user_${data.senderId}`).emit('messagesRead', { readerId: authId });
      });
  }
}
