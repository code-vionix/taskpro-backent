import { Body, Controller, Delete, Get, Param, Patch, Post, Request, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MessagesService } from './messages.service';
import { CloudinaryService } from '../common/cloudinary.service';

@Controller('messages')
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(
    private readonly messagesService: MessagesService,
    private readonly cloudinaryService: CloudinaryService
  ) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadMessageFile(
    @Request() req,
    @Body('receiverId') receiverId: string,
    @Body('messageType') messageType: string,
    @Body('content') content: string,
    @UploadedFile() file: Express.Multer.File
  ) {
    let fileUrl = '';
    if (file) {
        fileUrl = await this.cloudinaryService.uploadImage(file);
    }
    return this.messagesService.createMessage(req.user.userId, {
        receiverId,
        messageType,
        content,
        fileUrl,
        fileName: file?.originalname
    });
  }

  @Get('chats')
  getRecentChats(@Request() req) {
    return this.messagesService.getRecentChats(req.user.userId);
  }

  @Get('unread-count')
  async getUnreadCount(@Request() req) {
    const count = await this.messagesService.getUnreadCount(req.user.userId);
    return { count };
  }

  @Get('conversation/:otherUserId')
  getConversation(@Request() req, @Param('otherUserId') otherUserId: string) {
    return this.messagesService.getConversation(req.user.userId, otherUserId);
  }

  @Patch('read/:senderId')
  markAsRead(@Request() req, @Param('senderId') senderId: string) {
    return this.messagesService.markAsRead(req.user.userId, senderId);
  }

  @Delete(':id')
  remove(@Request() req, @Param('id') id: string) {
    return this.messagesService.remove(id, req.user.userId, req.user.role);
  }

  // Admin Surveillance
  @Get('admin/conversations')
  async getAllConversations(@Request() req) {
      if (req.user.role !== 'ADMIN') throw new Error('Unauthorized');
      return this.messagesService.getAllConversations();
  }

  @Get('admin/conversation/:u1/:u2')
  async getConversationAdmin(@Request() req, @Param('u1') u1: string, @Param('u2') u2: string) {
      if (req.user.role !== 'ADMIN') throw new Error('Unauthorized');
      return this.messagesService.getConversation(u1, u2);
  }
}
