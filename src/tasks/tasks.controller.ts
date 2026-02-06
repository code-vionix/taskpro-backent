import { Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post, Request, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CloudinaryService } from '../common/cloudinary.service';
import { RolesGuard } from '../common/guards/roles.guard';
import { TasksService } from './tasks.service';

@Controller('tasks')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TasksController {
  constructor(
    private readonly tasksService: TasksService,
    private readonly cloudinaryService: CloudinaryService
  ) {}

  @Post(':id/attachments')
  @UseInterceptors(FileInterceptor('file'))
  async uploadAttachment(@Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
    const url = await this.cloudinaryService.uploadImage(file);
    const task = await this.tasksService.findOne(id);
    if (!task) throw new NotFoundException('Task not found');
    
    const attachments = Array.isArray(task.attachments) ? task.attachments : [];
    const newAttachment = { name: file.originalname, url: url };
    
    return this.tasksService.update(id, task.userId || '', 'ADMIN' as any, { 
      attachments: [...attachments, newAttachment] 
    });
  }

  @Post()
  create(@Request() req, @Body() createTaskDto: any) {
    return this.tasksService.create(req.user.userId, createTaskDto, req.user.role);
  }

  @Get()
  findAll(@Request() req) {
    return this.tasksService.findAll(req.user.userId, req.user.role);
  }

  @Get('leaderboard')
  getLeaderboard() {
    return this.tasksService.getLeaderboard();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.tasksService.findOne(id);
  }

  @Patch(':id')
  update(@Request() req, @Param('id') id: string, @Body() updateTaskDto: any) {
    return this.tasksService.update(id, req.user.userId, req.user.role, updateTaskDto);
  }

  @Delete(':id')
  remove(@Request() req, @Param('id') id: string) {
    return this.tasksService.remove(id, req.user.userId, req.user.role);
  }

  @Patch(':id/stop')
  stop(@Request() req, @Param('id') id: string) {
    return this.tasksService.stopTask(id, req.user.userId, req.user.role);
  }

  @Patch(':id/start')
  start(@Request() req, @Param('id') id: string) {
    return this.tasksService.startTask(id, req.user.userId);
  }

  @Patch(':id/complete')
  complete(@Request() req, @Param('id') id: string, @Body() body: { score?: number, submissionNotes?: string }) {
    return this.tasksService.completeTask(id, req.user.userId, body.score, body.submissionNotes);
  }

  @Patch(':id/approve')
  approve(@Request() req, @Param('id') id: string) {
    if (req.user.role !== 'ADMIN') throw new NotFoundException('Not Found'); // Mask forbidden
    return this.tasksService.approveTask(id, req.user.userId);
  }

  @Patch(':id/reject')
  reject(@Request() req, @Param('id') id: string, @Body('reason') reason: string) {
    if (req.user.role !== 'ADMIN') throw new NotFoundException('Not Found'); // Mask forbidden
    return this.tasksService.rejectTask(id, req.user.userId, reason);
  }

  @Patch(':id/assign')
  assign(@Request() req, @Param('id') id: string) {
    return this.tasksService.assignTask(id, req.user.userId, req.user.role);
  }

  @Post(':id/comments')
  addComment(@Request() req, @Param('id') id: string, @Body('content') content: string) {
    return this.tasksService.addComment(id, req.user.userId, content);
  }

  @Delete('comments/:commentId')
  removeComment(@Request() req, @Param('commentId') commentId: string) {
    return this.tasksService.removeComment(commentId, req.user.userId, req.user.role);
  }

  @Patch('subtasks/:id/toggle')
  toggleSubTask(@Request() req, @Param('id') id: string) {
    return this.tasksService.toggleSubTask(id, req.user.userId, req.user.role);
  }

  @Patch('subsubtasks/:id/toggle')
  toggleSubSubTask(@Request() req, @Param('id') id: string) {
    return this.tasksService.toggleSubSubTask(id, req.user.userId, req.user.role);
  }

  @Patch(':id/activity')
  logActivity(@Request() req, @Param('id') id: string, @Body() body: { type: string; url?: string; duration?: number }) {
    return this.tasksService.logActivity(id, req.user.userId, body.type, body.url, body.duration);
  }
}
