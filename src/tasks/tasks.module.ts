import { Module } from '@nestjs/common';
import { CloudinaryService } from '../common/cloudinary.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { PrismaModule } from '../prisma/prisma.module';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [TasksController],
  providers: [TasksService, CloudinaryService],
})
export class TasksModule {}
