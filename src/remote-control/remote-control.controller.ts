import {
    Controller,
    Delete,
    Get,
    Param,
    Post,
    Request,
    UseGuards
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RemoteControlService } from './remote-control.service';

@Controller('remote-control')
@UseGuards(JwtAuthGuard)
export class RemoteControlController {
  constructor(private readonly remoteControlService: RemoteControlService) {}

  // Get user's registered devices
  @Get('devices')
  async getDevices(@Request() req) {
    return this.remoteControlService.getUserDevices(req.user.userId);
  }

  // Get specific device
  @Get('devices/:id')
  async getDevice(@Param('id') id: string) {
    return this.remoteControlService.getDevice(id);
  }

  // Delete device
  @Delete('devices/:id')
  async deleteDevice(@Param('id') id: string) {
    return this.remoteControlService.deleteDevice(id);
  }

  // Get session details
  @Get('sessions/:id')
  async getSession(@Param('id') id: string) {
    return this.remoteControlService.getSession(id);
  }

  // End session
  @Post('sessions/:id/end')
  async endSession(@Param('id') id: string) {
    return this.remoteControlService.endSession(id);
  }

  // Get session commands
  @Get('sessions/:id/commands')
  async getSessionCommands(@Param('id') id: string) {
    return this.remoteControlService.getSessionCommands(id);
  }
}
