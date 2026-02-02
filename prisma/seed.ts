import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seeding...');

  // Clear existing data
  await prisma.taskHistory.deleteMany();
  await prisma.subSubTask.deleteMany();
  await prisma.subTask.deleteMany();
  await prisma.task.deleteMany();
  await prisma.user.deleteMany();

  const hashedPassword = await bcrypt.hash('password123', 10);

  // Create Admin User
  const admin = await prisma.user.create({
    data: {
      email: 'admin@taskpro.com',
      password: hashedPassword,
      role: Role.ADMIN,
    },
  });

  // Create Regular User
  const user = await prisma.user.create({
    data: {
      email: 'user@taskpro.com',
      password: hashedPassword,
      role: Role.USER,
    },
  });

  console.log('Users created:', { admin: admin.email, user: user.email });

  // Create Tasks for Admin
  const adminTask1 = await prisma.task.create({
    data: {
      title: 'Infrastructure Upgrade',
      description: 'Upgrade the core database server and network protocols.',
      startTime: new Date(),
      endTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      userId: admin.id,
      isStopped: false,
      subTasks: {
        create: [
          {
            title: 'Database Migration',
            description: 'Migrate data to the new server.',
            subSubTasks: {
              create: [
                { title: 'Backup current data', description: 'Create a full SQL dump.' },
                { title: 'Schema Verification', description: 'Verify schema compatibility.' },
              ],
            },
          },
          {
            title: 'Network Config',
            description: 'Configure new firewall rules.',
          },
        ],
      },
    },
  });

  // Create Tasks for User
  const userTask1 = await prisma.task.create({
    data: {
      title: 'Complete Project Documentation',
      description: 'Finalize the API documentation and user manuals.',
      startTime: new Date(),
      endTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
      userId: user.id,
      isStopped: false,
      subTasks: {
        create: [
          {
            title: 'Write API Specs',
            description: 'Document all REST endpoints.',
            subSubTasks: {
              create: [
                { title: 'Auth Endpoints', description: 'Document login/register flow.' },
                { title: 'Task Endpoints', description: 'Document CRUD operations for tasks.' },
              ],
            },
          },
        ],
      },
    },
  });

  const userTask2 = await prisma.task.create({
    data: {
      title: 'Monthly Review',
      description: 'Analyze last months performance metrics.',
      startTime: new Date(),
      endTime: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
      userId: user.id,
      isStopped: true, // This one is stopped
    },
  });

  console.log('Seeding completed successfully.');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
