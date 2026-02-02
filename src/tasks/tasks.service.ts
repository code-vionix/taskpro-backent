
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TasksService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, createTaskDto: any, role: Role) {
    let targetUserId = userId;
    
    // Admin can assign tasks to other users
    if (role === Role.ADMIN && createTaskDto.assignedToEmail) {
      const user = await this.prisma.user.findUnique({
        where: { email: createTaskDto.assignedToEmail }
      });
      if (!user) {
          throw new NotFoundException(`User with email ${createTaskDto.assignedToEmail} not found`);
      }
      targetUserId = user.id;
    }

    // Convert duration from minutes to seconds if provided
    const duration = createTaskDto.duration ? parseInt(createTaskDto.duration) * 60 : 300; // Default 5 mins

    // Remove auxiliary fields before creation
    const { assignedToEmail, duration: dur, ...taskData } = createTaskDto;

    return this.prisma.task.create({
      data: {
        ...taskData,
        duration: duration,
        userId: targetUserId,
        startTime: new Date(),
        endTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Default window
      },
    });
  }

  async findAll(userId: string, role: Role) {
    if (role === Role.ADMIN) {
      return this.prisma.task.findMany({
        where: { deletedAt: null },
        include: { subTasks: { include: { subSubTasks: true } } }
      });
    }
    return this.prisma.task.findMany({
      where: { userId, deletedAt: null },
      include: { subTasks: { include: { subSubTasks: true } } },
    });
  }

  async findOne(id: string) {
    return this.prisma.task.findUnique({
      where: { id },
      include: { subTasks: { include: { subSubTasks: true } } },
    });
  }

  async update(id: string, userId: string, role: Role, updateTaskDto: any) {
    const task = await this.findOne(id);
    if (!task) throw new NotFoundException('Task not found');
    
    if (role !== Role.ADMIN && task.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    // History
    await this.prisma.taskHistory.create({
      data: {
        taskId: id,
        action: 'UPDATE',
        details: task as any,
      },
    });

    return this.prisma.task.update({
      where: { id },
      data: updateTaskDto,
    });
  }

  async remove(id: string, userId: string, role: Role) {
    const task = await this.findOne(id);
    if (!task) throw new NotFoundException('Task not found');

    // Authorization: Admin can delete any, User can only delete their own
    if (role !== Role.ADMIN && task.userId !== userId) {
        throw new ForbiddenException('Access denied');
    }

    // Soft delete logic for ALL roles (Admin & User)
    await this.prisma.taskHistory.create({
        data: {
            taskId: id,
            action: 'SOFT_DELETE',
            details: task as any,
        },
    });

    return this.prisma.task.update({
        where: { id },
        data: { deletedAt: new Date() },
    });
  }

  async stopTask(id: string, userId: string, role: Role) {
    const task = await this.findOne(id);
    if (!task) throw new NotFoundException('Task not found');

    // Admin can stop any task
    // User can only stop PRACTICE tasks they own
    if (role !== Role.ADMIN) {
        if (task.userId !== userId) throw new ForbiddenException('Access denied');
        if (task.type === 'EXAM') throw new ForbiddenException('Cannot stop EXAM tasks');
    }

    // Toggle stop/resume? Or just stop? The Prompt says "user time push o korte parbe" which implies pause/resume.
    // Let's assume this endpoint toggles isStopped or just sets it to true.
    // The current implementation sets isStopped: true.
    // If we want to support pause/resume properly, we might need a separate resume endpoint or toggle logic.
    // For now, let's make it pause (isStopped = true).
    
    return this.prisma.task.update({
      where: { id },
      data: { isStopped: true },
    });
  }

  async startTask(id: string, userId: string) {
    const task = await this.findOne(id);
    if (!task) throw new NotFoundException('Task not found');
    if (task.userId !== userId) throw new ForbiddenException('Access denied');
    
    // If task is stopped, resume it (set isStopped = false)
    if (task.isStopped) {
         return this.prisma.task.update({
            where: { id },
            data: { isStopped: false },
         });
    }

    if (task.status !== 'PENDING') throw new ForbiddenException('Task already started or completed');

    return this.prisma.task.update({
      where: { id },
      data: { 
        status: 'IN_PROGRESS', 
        startedAt: new Date() 
      },
    });
  }

  async completeTask(id: string, userId: string) {
    const task = await this.findOne(id);
    if (!task) throw new NotFoundException('Task not found');
    if (task.userId !== userId) throw new ForbiddenException('Access denied');
    if (task.status !== 'IN_PROGRESS') throw new ForbiddenException('Task not in progress');
    
    // Check if time expired
    if (task.startedAt && task.duration) {
        const now = new Date();
        const expirationTime = new Date(task.startedAt.getTime() + task.duration * 1000);
        // Add a small buffer (e.g., 5 seconds) for network latency
        if (now.getTime() > expirationTime.getTime() + 5000) {
             await this.prisma.task.update({
                where: { id },
                data: { status: 'EXPIRED' }
             });
             throw new ForbiddenException('Task time expired');
        }
    }

    return this.prisma.task.update({
      where: { id },
      data: { 
        status: 'COMPLETED', 
        completedAt: new Date() 
      },
    });
  }
}
