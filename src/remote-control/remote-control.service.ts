import { Injectable } from '@nestjs/common';
import { CommandStatus, CommandType, DeviceStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RemoteControlService {
  constructor(private prisma: PrismaService) {}

  // Register or update device
  async registerDevice(
    userId: string,
    deviceInfo: {
      deviceName: string;
      deviceModel?: string;
      osVersion?: string;
      appVersion?: string;
      deviceId: string;
      fcmToken?: string;
    },
    socketId: string,
  ) {
    const existingDevice = await this.prisma.registeredDevice.findUnique({
      where: { deviceId: deviceInfo.deviceId },
    });

    if (existingDevice) {
      return this.prisma.registeredDevice.update({
        where: { id: existingDevice.id },
        data: {
          status: DeviceStatus.ONLINE,
          socketId,
          lastSeen: new Date(),
          ...deviceInfo,
        },
      });
    }

    return this.prisma.registeredDevice.create({
      data: {
        userId,
        ...deviceInfo,
        socketId,
        status: DeviceStatus.ONLINE,
      },
    });
  }

  // Handle device disconnect
  async handleDeviceDisconnect(socketId: string) {
    const device = await this.prisma.registeredDevice.findFirst({
      where: { socketId },
    });

    if (device) {
      await this.prisma.registeredDevice.update({
        where: { id: device.id },
        data: {
          status: DeviceStatus.OFFLINE,
          socketId: null,
        },
      });

      // End active sessions
      await this.prisma.remoteSession.updateMany({
        where: {
          deviceId: device.id,
          isActive: true,
        },
        data: {
          isActive: false,
          endedAt: new Date(),
        },
      });
    }
  }

  // Get user's devices
  async getUserDevices(userId: string) {
    return this.prisma.registeredDevice.findMany({
      where: {
        userId,
        isActive: true,
      },
      orderBy: {
        lastSeen: 'desc',
      },
    });
  }

  // Start remote session
  async startSession(deviceId: string, webSocketId: string, requestingUserId: string) {
    const device = await this.prisma.registeredDevice.findUnique({
      where: { id: deviceId },
    });

    if (!device) {
      throw new Error('Device not found');
    }

    if (device.userId !== requestingUserId) {
        throw new Error('Forbidden: You do not own this device');
    }

    if (device.status !== DeviceStatus.ONLINE) {
      throw new Error('Device is not online');
    }

    // End any existing active sessions for this device
    await this.prisma.remoteSession.updateMany({
      where: {
        deviceId,
        isActive: true,
      },
      data: {
        isActive: false,
        endedAt: new Date(),
      },
    });

    return this.prisma.remoteSession.create({
      data: {
        deviceId,
        webSocketId,
        isActive: true,
      },
      include: {
        device: true,
      },
    });
  }

  // Update session status
  async updateSessionStatus(sessionId: string, accepted: boolean) {
    return this.prisma.remoteSession.update({
      where: { id: sessionId },
      data: {
        isActive: accepted,
        endedAt: accepted ? null : new Date(),
      },
    });
  }

  // Get session
  async getSession(sessionId: string) {
    return this.prisma.remoteSession.findUnique({
      where: { id: sessionId },
      include: {
        device: true,
      },
    });
  }

  // Create command
  async createCommand(
    sessionId: string,
    type: string,
    payload?: any,
  ) {
    return this.prisma.remoteCommand.create({
      data: {
        sessionId,
        type: type as CommandType,
        payload,
        status: CommandStatus.PENDING,
      },
    });
  }

  // Update command status
  async updateCommandStatus(
    commandId: string,
    status: string,
    result?: any,
    error?: string,
  ) {
    return this.prisma.remoteCommand.update({
      where: { id: commandId },
      data: {
        status: status as CommandStatus,
        result,
        error,
        executedAt: status === 'EXECUTING' ? new Date() : undefined,
        completedAt:
          status === 'COMPLETED' || status === 'FAILED' ? new Date() : undefined,
      },
    });
  }

  // Get command
  async getCommand(commandId: string) {
    return this.prisma.remoteCommand.findUnique({
      where: { id: commandId },
    });
  }

  // Get session commands
  async getSessionCommands(sessionId: string) {
    return this.prisma.remoteCommand.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // End session
  async endSession(sessionId: string) {
    return this.prisma.remoteSession.update({
      where: { id: sessionId },
      data: {
        isActive: false,
        endedAt: new Date(),
      },
    });
  }

  // Get device by ID
  async getDevice(deviceId: string) {
    return this.prisma.registeredDevice.findUnique({
      where: { id: deviceId },
    });
  }

  // Delete device
  async deleteDevice(deviceId: string) {
    return this.prisma.registeredDevice.update({
      where: { id: deviceId },
      data: {
        isActive: false,
      },
    });
  }
}
