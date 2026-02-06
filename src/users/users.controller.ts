
import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Request, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import * as bcrypt from 'bcrypt';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CloudinaryService } from '../common/cloudinary.service';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  @Get()
  findAll(@Request() req) {
    return this.usersService.findAll();
  }

  @Get('profile')
  getOwnProfile(@Request() req) {
    return this.usersService.findProfile(req.user.userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findProfile(id);
  }

  @Patch('profile/update')
  async updateProfileInfo(@Request() req, @Body() body: { 
    name?: string; 
    password?: string;
    bio?: string;
    address?: string;
    education?: string;
  }) {
    const data: any = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.bio !== undefined) data.bio = body.bio;
    if (body.address !== undefined) data.address = body.address;
    if (body.education !== undefined) data.education = body.education;
    
    if (body.password) {
        data.password = await bcrypt.hash(body.password, 10);
    }
    
    return this.usersService.update(req.user.userId, data);
  }

  @Patch('profile/category')
  async updateCategory(@Request() req, @Body('category') category: string) {
      if (!category) throw new BadRequestException('Category is required');
      return this.usersService.updateCategory(req.user.userId, category);
  }

  @Patch('profile')
  async update(@Request() req, @Body() updateDto: { 
    name?: string; 
    bio?: string; 
    address?: string; 
    education?: string; 
    avatarUrl?: string; 
    coverImageUrl?: string; 
    coverPosition?: any; 
    avatarPosition?: any;
    password?: string;
    // Permissions (Admin only)
    canPost?: boolean;
    canMessage?: boolean;
    canUseCommunity?: boolean;
    canCreateTask?: boolean;
  }) {
    const data: any = { ...updateDto };
    
    // Special handling for password - hash it before saving
    if (data.password) {
        data.password = await bcrypt.hash(data.password, 10);
    } else {
        delete data.password;
    }

    return this.usersService.update(req.user.userId, data);
  }

  @Patch(':id/permissions')
  async updatePermissions(@Request() req, @Param('id') id: string, @Body() permissions: {
      canPost?: boolean;
      canMessage?: boolean;
      canUseCommunity?: boolean;
      canCreateTask?: boolean;
      role?: any;
  }) {
      if (req.user.role !== 'ADMIN') {
          throw new BadRequestException('Unauthorized: Only admins can manage permissions');
      }
      return this.usersService.update(id, permissions);
  }

  @Delete(':id')
  async remove(@Request() req, @Param('id') id: string) {
      if (req.user.role !== 'ADMIN') {
          throw new BadRequestException('Unauthorized: Only admins can delete users');
      }
      return this.usersService.remove(id);
  }

  @Post('upload-avatar')
  @UseInterceptors(FileInterceptor('file'))
  async uploadAvatar(@Request() req, @UploadedFile() file: Express.Multer.File) {
    const url = await this.cloudinaryService.uploadImage(file);
    await this.usersService.update(req.user.userId, { avatarUrl: url });
    return { url };
  }

  @Post('upload-cover')
  @UseInterceptors(FileInterceptor('file'))
  async uploadCover(@Request() req, @UploadedFile() file: Express.Multer.File) {
    const url = await this.cloudinaryService.uploadImage(file);
    await this.usersService.update(req.user.userId, { coverImageUrl: url });
    return { url };
  }

  @Post(':id/follow')
  async follow(@Request() req, @Param('id') id: string) {
      return this.usersService.follow(req.user.userId, id);
  }

  @Post(':id/unfollow')
  async unfollow(@Request() req, @Param('id') id: string) {
      return this.usersService.unfollow(req.user.userId, id);
  }

  @Get(':id/followers')
  async getFollowers(@Param('id') id: string) {
      return this.usersService.getFollowers(id);
  }

  @Get(':id/following')
  async getFollowing(@Param('id') id: string) {
      return this.usersService.getFollowing(id);
  }
}
