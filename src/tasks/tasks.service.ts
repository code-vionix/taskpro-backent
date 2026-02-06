
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
      const targetUser = await this.prisma.user.findUnique({
        where: { email: createTaskDto.assignedToEmail }
      });
      if (!targetUser) {
          throw new NotFoundException(`User with email ${createTaskDto.assignedToEmail} not found`);
      }
      targetUserId = targetUser.id;
    }

    // Convert duration from minutes to seconds if provided
    const duration = createTaskDto.duration ? parseInt(createTaskDto.duration) * 60 : 300; // Default 5 mins

    // Remove auxiliary fields before creation
    const { assignedToEmail, duration: dur, ...taskData } = createTaskDto;

    // Default dates if not provided
    const startTime = taskData.startTime ? new Date(taskData.startTime) : new Date();
    const endTime = taskData.endTime ? new Date(taskData.endTime) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const task = await this.prisma.task.create({
      data: {
        ...taskData,
        duration: duration,
        userId: targetUserId,
        startTime,
        endTime,
      },
    });

    if (targetUserId) {
        await this.notifications.create({
            userId: targetUserId,
            type: 'TASK_ASSIGNED',
            message: `Admin assigned a new task: ${task.title}`,
            data: { taskId: task.id }
        });
    }

    return task;
  }

  async findAll(userId: string, role: Role) {
    let where: any = { deletedAt: null };
    
    if (role !== Role.ADMIN) {
      const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { category: true } });
      
      if (!user?.category) {
          // If no category, users can only see tasks already assigned to them
          where.userId = userId;
      } else {
          where.AND = [
              { category: user.category },
              {
                OR: [
                  { userId: userId },
                  { userId: null }
                ]
              }
          ];
      }
    }

    return this.prisma.task.findMany({
      where,
      include: { 
        subTasks: { include: { subSubTasks: true } },
        _count: { select: { comments: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async assignTask(taskId: string, userId: string, role: Role) {
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Task not found');
    if (task.userId) throw new ForbiddenException('Task is already assigned');

    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { category: true } });
    if (!user?.category) {
        throw new ForbiddenException('You must select an Operation Category in your profile before claiming signals.');
    }

    if (user.category !== task.category) {
        throw new ForbiddenException(`Access Denied: You are registered for ${user.category}. Cannot claim ${task.category} signals.`);
    }

    return this.prisma.task.update({
      where: { id: taskId },
      data: { userId: userId }
    });
  }

  async findOne(id: string) {
    return this.prisma.task.findUnique({
      where: { id },
      include: { 
        subTasks: { include: { subSubTasks: true } },
        comments: {
          include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
          orderBy: { createdAt: 'desc' }
        },
        user: { select: { id: true, name: true, email: true, avatarUrl: true } }
      },
    });
  }

  async update(id: string, userId: string, role: Role, updateTaskDto: any) {
    const task = await this.findOne(id);
    if (!task) throw new NotFoundException('Task not found');
    
    if (role !== Role.ADMIN && task.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    // Capture history
    await this.prisma.taskHistory.create({
      data: { taskId: id, action: 'UPDATE', details: task as any },
    });

    // Handle score calculation on completion (if it was an exam)
    if (updateTaskDto.status === 'COMPLETED' && task.status !== 'COMPLETED' && task.type === 'EXAM') {
        // Base score if not provided
        updateTaskDto.score = updateTaskDto.score || 100;
    }

    const updatedTask = await this.prisma.task.update({
      where: { id },
      data: updateTaskDto,
    });

    return updatedTask;
  }

  // Comments Management
  async addComment(taskId: string, userId: string, content: string) {
    const comment = await this.prisma.taskComment.create({
      data: { taskId, userId, content },
      include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } }
    });

    // Notify task owner if someone else comments
    const task = await this.prisma.task.findUnique({ where: { id: taskId }, select: { userId: true, title: true } });
    if (task && task.userId && task.userId !== userId) {
      await this.notifications.create({
        userId: task.userId,
        type: 'COMMENT',
        message: `Someone commented on your task: ${task.title}`,
        data: { taskId }
      });
    }

    return comment;
  }

  async removeComment(commentId: string, userId: string, role: Role) {
    const comment = await this.prisma.taskComment.findUnique({ where: { id: commentId } });
    if (!comment) throw new NotFoundException('Comment not found');

    if (role !== Role.ADMIN && comment.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return this.prisma.taskComment.delete({ where: { id: commentId } });
  }

  // Leaderboard
  async getLeaderboard() {
    return this.prisma.user.findMany({
      where: { tasks: { some: { status: 'COMPLETED', type: 'EXAM' } } },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        _count: {
          select: { tasks: { where: { status: 'COMPLETED', type: 'EXAM' } } }
        },
        tasks: {
          where: { status: 'COMPLETED', type: 'EXAM' },
          select: { score: true }
        }
      }
    }).then(users => {
      return users.map(u => ({
        ...u,
        totalScore: u.tasks.reduce((sum, t) => sum + (t.score || 0), 0),
        taskCount: u._count.tasks
      })).sort((a, b) => b.totalScore - a.totalScore);
    });
  }

  async remove(id: string, userId: string, role: Role) {
    const task = await this.findOne(id);
    if (!task) throw new NotFoundException('Task not found');
    if (role !== Role.ADMIN && task.userId !== userId) throw new ForbiddenException('Access denied');

    await this.prisma.taskHistory.create({
        data: { taskId: id, action: 'SOFT_DELETE', details: task as any },
    });

    return this.prisma.task.update({
        where: { id },
        data: { deletedAt: new Date() },
    });
  }

  async stopTask(id: string, userId: string, role: Role) {
    const task = await this.findOne(id);
    if (!task) throw new NotFoundException('Task not found');

    if (role !== Role.ADMIN) {
        if (task.userId !== userId) throw new ForbiddenException('Access denied');
        if (task.type === 'EXAM') throw new ForbiddenException('Cannot stop EXAM tasks');
    }
    
    return this.prisma.task.update({
      where: { id },
      data: { isStopped: true, lastStoppedAt: new Date() },
    });
  }

  async startTask(id: string, userId: string) {
    const task = await this.findOne(id);
    if (!task) throw new NotFoundException('Task not found');
    if (task.userId !== userId) throw new ForbiddenException('Access denied');
    
    if (task.isStopped) {
         let newStartedAt = task.startedAt;
         const lastStoppedAt = (task as any).lastStoppedAt;
         if (lastStoppedAt && task.startedAt) {
             const gap = Date.now() - new Date(lastStoppedAt).getTime();
             newStartedAt = new Date(task.startedAt.getTime() + gap);
         }
         return this.prisma.task.update({
            where: { id },
            data: { isStopped: false, startedAt: newStartedAt, lastStoppedAt: null },
         });
    }

    if (task.status !== 'PENDING') throw new ForbiddenException('Task already started or completed');

    return this.prisma.task.update({
      where: { id },
      data: { status: 'IN_PROGRESS', startedAt: new Date() },
    });
  }

  async completeTask(id: string, userId: string, score: number = 0, submissionNotes: string = '') {
    const task = await this.findOne(id);
    if (!task || task.userId !== userId) throw new ForbiddenException('Access denied');
    if (task.status !== 'IN_PROGRESS') throw new ForbiddenException('Task not in progress');
    
    if (!submissionNotes || submissionNotes.trim().length < 10) {
        throw new ForbiddenException('Please provide detailed mission notes (min 10 characters) as proof of work.');
    }

    const now = new Date();
    if (task.startedAt && task.duration) {
        const expirationTime = new Date(task.startedAt.getTime() + task.duration * 1000);
        if (now.getTime() > expirationTime.getTime() + 10000) { // 10s grace
             await this.prisma.task.update({ where: { id }, data: { status: 'EXPIRED' } });
             throw new ForbiddenException('Mission window expired. Connection lost.');
        }
    }

    const updatedTask = await this.prisma.task.update({
      where: { id },
      data: { 
        status: 'UNDER_REVIEW', 
        completedAt: now, 
        score: score || (task.type === 'EXAM' ? 100 : 0),
        submissionNotes: submissionNotes
      },
    });

    // Notify admins for review
    const admins = await this.prisma.user.findMany({ where: { role: 'ADMIN' } });
    for (const admin of admins) {
        await this.notifications.create({
            userId: admin.id,
            type: 'TASK_UNDER_REVIEW',
            message: `New broadcast to review: ${task.title} from ${task.user?.name || task.user?.email}`,
            data: { taskId: task.id }
        });
    }

    return updatedTask;
  }

  async approveTask(id: string, adminId: string) {
    const task = await this.findOne(id);
    if (!task) throw new NotFoundException('Task not found');
    if (task.status !== 'UNDER_REVIEW') throw new ForbiddenException('Task is not under review');

    const updatedTask = await this.prisma.task.update({
      where: { id },
      data: { status: 'COMPLETED' },
    });

    if (task.userId) {
        await this.notifications.create({
            userId: task.userId,
            type: 'TASK_APPROVED',
            message: `Mission Authenticated: ${task.title}. Rewards credited.`,
            data: { taskId: task.id }
        });

        // Recurrence only triggers on final approval
        if (task.isRecurring && task.recurrence === 'DAILY') {
            await this.prisma.task.create({
                data: {
                    title: task.title,
                    description: task.description,
                    userId: task.userId,
                    type: task.type,
                    duration: task.duration,
                    priority: task.priority,
                    tags: task.tags,
                    isRecurring: true,
                    recurrence: 'DAILY',
                    startTime: new Date(task.startTime.getTime() + 24 * 60 * 60 * 1000),
                    endTime: new Date(task.endTime.getTime() + 24 * 60 * 60 * 1000),
                }
            });
        }
    }

    return updatedTask;
  }

  async rejectTask(id: string, adminId: string, reason: string) {
    const task = await this.findOne(id);
    if (!task) throw new NotFoundException('Task not found');
    if (task.status !== 'UNDER_REVIEW') throw new ForbiddenException('Task is not under review');

    const updatedTask = await this.prisma.task.update({
      where: { id },
      data: { status: 'REJECTED' },
    });

    if (task.userId) {
        await this.notifications.create({
            userId: task.userId,
            type: 'TASK_REJECTED',
            message: `Mission Rejected: ${task.title}. Reason: ${reason}`,
            data: { taskId: task.id }
        });
        
        // Auto-comment the rejection reason
        await this.addComment(id, adminId, `[SYSTEM ALERT - REJECTION]: ${reason}`);
    }

    return updatedTask;
  }

  // Sub-task Management
  async toggleSubTask(subTaskId: string, userId: string, role: Role) {
    const subTask = await this.prisma.subTask.findUnique({
        where: { id: subTaskId },
        include: { task: true }
    });
    if (!subTask) throw new NotFoundException('Sub-task not found');
    
    // Check if user has access to the parent task
    if (role !== Role.ADMIN && subTask.task.userId !== userId) {
        throw new ForbiddenException('Access denied');
    }

    return this.prisma.subTask.update({
        where: { id: subTaskId },
        data: { isCompleted: !subTask.isCompleted }
    });
  }

  async toggleSubSubTask(subSubTaskId: string, userId: string, role: Role) {
    const subSubTask = await this.prisma.subSubTask.findUnique({
        where: { id: subSubTaskId },
        include: { subTask: { include: { task: true } } }
    });
    if (!subSubTask) throw new NotFoundException('Sub-sub-task not found');

    if (role !== Role.ADMIN && subSubTask.subTask.task.userId !== userId) {
        throw new ForbiddenException('Access denied');
    }

    return this.prisma.subSubTask.update({
        where: { id: subSubTaskId },
        data: { isCompleted: !subSubTask.isCompleted }
    });
  }
}
