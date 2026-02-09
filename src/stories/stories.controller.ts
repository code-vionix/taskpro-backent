import { Body, Controller, Delete, Get, Param, Post, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { StoriesService } from './stories.service';

@Controller('stories')
@UseGuards(JwtAuthGuard)
export class StoriesController {
  constructor(private readonly storiesService : StoriesService) {}

  @Post()
  create(@Request() req, @Body('imageUrl') imageUrl: string) {
    return this.storiesService.create(req.user.userId, imageUrl);
  }

  @Get()
  findAll() {
    return this.storiesService.findAll();
  }

  @Delete(':id')
  remove(@Request() req, @Param('id') id: string) {
    return this.storiesService.remove(id, req.user.userId, req.user.role);
  }
}
