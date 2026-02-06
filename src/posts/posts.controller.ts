import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Request, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ReactionType } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CloudinaryService } from '../common/cloudinary.service';
import { PostsService } from './posts.service';

@Controller('posts')
@UseGuards(JwtAuthGuard)
export class PostsController {
  constructor(
      private readonly postsService: PostsService,
      private readonly cloudinaryService: CloudinaryService
  ) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async create(@Request() req, @Body() createPostDto: any, @UploadedFile() file: Express.Multer.File) {
    let imageUrl = createPostDto.imageUrl;
    if (file) {
        imageUrl = await this.cloudinaryService.uploadImage(file);
    }
    return this.postsService.create(req.user.userId, { ...createPostDto, imageUrl });
  }

  @Get()
  findAll(
    @Request() req,
    @Query('page') page: string = '1', 
    @Query('limit') limit: string = '10',
    @Query('following') following?: string
  ) {
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);
    const onlyFollowing = following === 'true';
    return this.postsService.findAll(skip, take, req.user.userId, onlyFollowing);
  }

  @Get('user/:userId')
  findByUser(@Param('userId') userId: string, @Query('page') page: string = '1', @Query('limit') limit: string = '10') {
      const skip = (parseInt(page) - 1) * parseInt(limit);
      const take = parseInt(limit);
      return this.postsService.findByUser(userId, skip, take);
  }

  @Post(':id/share')
  share(@Request() req, @Param('id') id: string, @Body('content') content?: string) {
      return this.postsService.sharePost(req.user.userId, id, content);
  }

  @Post(':id/react')
  react(@Request() req, @Param('id') id: string, @Body('type') type: ReactionType) {
      return this.postsService.addReaction(req.user.userId, id, type);
  }

  @Post(':id/comment')
  comment(@Request() req, @Param('id') id: string, @Body('content') content: string, @Body('parentId') parentId?: string) {
      return this.postsService.addComment(req.user.userId, id, content, parentId);
  }

  @Patch(':id')
  async update(@Request() req, @Param('id') id: string, @Body() updatePostDto: any) {
    return this.postsService.update(id, req.user.userId, updatePostDto);
  }

  @Delete(':id')
  remove(@Request() req, @Param('id') id: string) {
    return this.postsService.remove(id, req.user.userId, req.user.role);
  }
}
