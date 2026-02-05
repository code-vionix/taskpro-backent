
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TasksService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  async create(userId: string, createTaskDto: any, role: Role) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const isAdmin = role === Role.ADMIN;
    
    if (!isAdmin && (!user || !user.canCreateTask)) {
      throw new ForbiddenException('You are not authorized to create tasks');
    }

    let targetUserId: string | null = null;
    
    // If admin explicitly assigns to a user
    if (createTaskDto.assignedToEmail) {
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

    const task = await this.prisma.task.create({
      data: {
        ...taskData,
        duration: duration,
        userId: targetUserId, // Can be null now
        startTime: new Date(),
        endTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Default window
      },
    });

    if (targetUserId) {
        await this.notifications.create({
            userId: targetUserId,
            type: 'TASK_ASSIGNED',
            message: `Admin assigned a new task to you: ${task.title}`,
            data: { taskId: task.id }
        });
    }

    return task;
  }

  async findAll(userId: string, role: Role) {
    if (role === Role.ADMIN) {
      return this.prisma.task.findMany({
        where: { deletedAt: null },
        include: { subTasks: { include: { subSubTasks: true } } }
      });
    }
    // Users see their own tasks AND unassigned tasks (available pool)
    return this.prisma.task.findMany({
      where: { 
        deletedAt: null,
        OR: [
          { userId: userId },
          { userId: null }
        ]
      },
      include: { subTasks: { include: { subSubTasks: true } } },
    });
  }

  async assignTask(taskId: string, userId: string, role: Role) {
    // Check if task exists and is unassigned
    const task = await this.prisma.task.findUnique({
      where: { id: taskId }
    });

    if (!task) throw new NotFoundException('Task not found');

    // If task is already assigned
    if (task.userId) {
       // If user is trying to assign to self but it's already taken
       // "kono user ekta task e asgin korle oi task e ar kaw asgin korte parbe na"
       throw new ForbiddenException('Task is already assigned to a user');
    }

    // Assign to self
    return this.prisma.task.update({
      where: { id: taskId },
      data: { userId: userId }
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

    // Handle email assignment for Admins
    if (role === Role.ADMIN && updateTaskDto.assignedToEmail) {
        const user = await this.prisma.user.findUnique({
             where: { email: updateTaskDto.assignedToEmail }
        });
        if (!user) throw new NotFoundException(`User with email ${updateTaskDto.assignedToEmail} not found`);
        updateTaskDto.userId = user.id;
        delete updateTaskDto.assignedToEmail;
    } else if (updateTaskDto.assignedToEmail) {
        // Non-admins shouldn't be assigning tasks? Or ignore?
        // Safe to just delete it to prevent errors if schema is strict, though schema doesn't have it.
        delete updateTaskDto.assignedToEmail;
    }

    const updatedTask = await this.prisma.task.update({
      where: { id },
      data: updateTaskDto,
    });

    if (updateTaskDto.userId && updateTaskDto.userId !== task.userId) {
        await this.notifications.create({
            userId: updateTaskDto.userId,
            type: 'TASK_ASSIGNED',
            message: `Admin assigned a task to you: ${updatedTask.title}`,
            data: { taskId: updatedTask.id }
        });
    }

    return updatedTask;
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
      data: { 
          isStopped: true,
          lastStoppedAt: new Date()
      },
    });
  }

  async startTask(id: string, userId: string) {
    const task = await this.findOne(id);
    if (!task) throw new NotFoundException('Task not found');
    if (task.userId !== userId) throw new ForbiddenException('Access denied');
    
    // If task is stopped, resume it (set isStopped = false)
    // If task is stopped, resume it (set isStopped = false)
    if (task.isStopped) {
         let newStartedAt = task.startedAt;
         const lastStoppedAt = (task as any).lastStoppedAt;
         
         if (lastStoppedAt && task.startedAt) {
             const gap = Date.now() - new Date(lastStoppedAt).getTime();
             newStartedAt = new Date(task.startedAt.getTime() + gap);
         }

         return this.prisma.task.update({
            where: { id },
            data: { 
                isStopped: false,
                startedAt: newStartedAt,
                lastStoppedAt: null
            },
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
