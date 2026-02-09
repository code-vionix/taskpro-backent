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
import { RemoteControlService } from './remote-control.service';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: 'remote-control',
})
export class RemoteControlGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  constructor(private readonly remoteControlService: RemoteControlService) {}

  async handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
  }

  async handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
    await this.remoteControlService.handleDeviceDisconnect(client.id);
  }

  // Mobile app registers device
  @SubscribeMessage('device:register')
  async handleDeviceRegister(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: any,
  ) {
    console.log('Received device:register request:', data);
    try {
      const device = await this.remoteControlService.registerDevice(
        data.userId,
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
      const session = await this.remoteControlService.startSession(
        data.deviceId,
        client.id,
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
    const session = await this.remoteControlService.updateSessionStatus(
      data.sessionId,
      data.accepted,
    );

    // Notify web client
    this.server.to(`session:${data.sessionId}`).emit('session:status', {
      accepted: data.accepted,
      session,
    });

    return { success: true };
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
      const command = await this.remoteControlService.createCommand(
        data.sessionId,
        data.type,
        data.payload,
      );

      // Forward command to device
      const session = await this.remoteControlService.getSession(
        data.sessionId,
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

  // Device sends command result
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
    await this.remoteControlService.updateCommandStatus(
      data.commandId,
      data.status,
      data.result,
      data.error,
    );

    // Notify web client
    const command = await this.remoteControlService.getCommand(data.commandId);
    if (command) {
        this.server.to(`session:${command.sessionId}`).emit('command:completed', {
            commandId: data.commandId,
            status: data.status,
            result: data.result,
            error: data.error,
        });
    }

    return { success: true };
  }

  // WebRTC signaling for screen sharing
  @SubscribeMessage('webrtc:offer')
  async handleWebRTCOffer(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string; offer: any },
  ) {
    const session = await this.remoteControlService.getSession(data.sessionId);
    if (session) {
        this.server.to(`device:${session.deviceId}`).emit('webrtc:offer', {
            sessionId: data.sessionId,
            offer: data.offer,
        });
    }
    return { success: true };
  }

  @SubscribeMessage('webrtc:answer')
  async handleWebRTCAnswer(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string; answer: any },
  ) {
    this.server.to(`session:${data.sessionId}`).emit('webrtc:answer', {
      answer: data.answer,
    });
    return { success: true };
  }

  @SubscribeMessage('webrtc:ice-candidate')
  async handleICECandidate(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      sessionId: string;
      candidate: any;
      target: 'web' | 'device';
    },
  ) {
    if (data.target === 'device') {
      const session = await this.remoteControlService.getSession(
        data.sessionId,
      );
      if (session) {
        this.server.to(`device:${session.deviceId}`).emit('webrtc:ice-candidate', {
            candidate: data.candidate,
        });
      }
    } else {
      this.server.to(`session:${data.sessionId}`).emit('webrtc:ice-candidate', {
        candidate: data.candidate,
      });
    }
    return { success: true };
  }

  // Screen frame streaming (fallback if WebRTC fails)
  @SubscribeMessage('screen:frame')
  async handleScreenFrame(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string; frame: string },
  ) {
    this.server.to(`session:${data.sessionId}`).emit('screen:frame', {
      frame: data.frame,
    });
  }
}
