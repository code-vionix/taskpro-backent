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
  maxHttpBufferSize: 1e8, // 100 MB for large payloads (images)
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
        await this.remoteControlService.updateCommandStatus(
          data.commandId,
          data.status,
          data.result,
          data.error,
        );
    } catch (err) {
        console.error(`Backend failed to update status for ${data.commandId}:`, err);
        return { success: false, error: err.message };
    }

    // Notify web client
    const command = await this.remoteControlService.getCommand(data.commandId);
    if (command) {
        this.server.to(`session:${command.sessionId}`).emit('command:completed', {
            ...data,
            type: command.type,
        });
    }

    return { success: true };
  }

  // WebRTC signaling relay
  @SubscribeMessage('webrtc:offer')
  async handleWebRTCOffer(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string; [key: string]: any },
  ) {
    const session = await this.remoteControlService.getSession(data.sessionId);
    if (session) {
        this.server.to(`device:${session.deviceId}`).emit('webrtc:offer', data);
    }
    return { success: true };
  }

  @SubscribeMessage('webrtc:answer')
  async handleWebRTCAnswer(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string; [key: string]: any },
  ) {
    this.server.to(`session:${data.sessionId}`).emit('webrtc:answer', data);
    return { success: true };
  }

  @SubscribeMessage('webrtc:ice-candidate')
  async handleICECandidate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string; target?: string; [key: string]: any },
  ) {
    // If target is 'web', route to the session room
    if (data.target === 'web') {
      this.server.to(`session:${data.sessionId}`).emit('webrtc:ice-candidate', data);
    } 
    // If target is 'device' or not specified (default from web client), route to device
    else {
      const session = await this.remoteControlService.getSession(data.sessionId);
      if (session) {
        this.server.to(`device:${session.deviceId}`).emit('webrtc:ice-candidate', data);
      }
    }
    return { success: true };
  }

  // Screen frame streaming (fallback if WebRTC fails)
  @SubscribeMessage('screen:frame')
  async handleScreenFrame(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string; frame: string; type?: string },
  ) {
    if (data.type !== 'camera') {
        // Log only screen frames occasionally to avoid spamming
        if (Math.random() < 0.05) {
            console.log(`Forwarding screen frame for session: ${data.sessionId}`);
        }
    }
    this.server.to(`session:${data.sessionId}`).emit('screen:frame', {
      frame: data.frame,
      type: data.type, // Forward the type (camera or screen)
    });
  }
}
