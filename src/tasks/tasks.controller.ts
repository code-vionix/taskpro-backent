
import { Body, Controller, Delete, Get, Param, Patch, Post, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { TasksService } from './tasks.service';

@Controller('tasks')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  create(@Request() req, @Body() createTaskDto: any) {
    return this.tasksService.create(req.user.userId, createTaskDto, req.user.role);
  }

  @Get()
  findAll(@Request() req) {
    return this.tasksService.findAll(req.user.userId, req.user.role);
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
  complete(@Request() req, @Param('id') id: string) {
    return this.tasksService.completeTask(id, req.user.userId);
  }
}
