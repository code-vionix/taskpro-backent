import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seeding...');

  // Clear existing data
  // await prisma.taskHistory.deleteMany();
  // await prisma.subSubTask.deleteMany();
  // await prisma.subTask.deleteMany();
  // await prisma.task.deleteMany();
  // await prisma.user.deleteMany();

  const hashedPassword = await bcrypt.hash('password123', 10);

  // Create/Update Admin User
  const admin = await prisma.user.upsert({
    where: { email: 'admin@taskpro.com' },
    update: {},
    create: {
      email: 'admin@taskpro.com',
      password: hashedPassword,
      role: Role.ADMIN,
    },
  });

  // Create/Update Regular User
  const user = await prisma.user.upsert({
    where: { email: 'user@taskpro.com' },
    update: {},
    create: {
      email: 'user@taskpro.com',
      password: hashedPassword,
      role: Role.USER,
    },
  });

  console.log('Users created:', { admin: admin.email, user: user.email });

  // Create Tasks for Admin (only if none exist yet — idempotent)
  const adminTaskCount = await prisma.task.count({ where: { userId: admin.id } });
  if (adminTaskCount === 0) {
    await prisma.task.create({
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
    console.log('Admin tasks created.');
  } else {
    console.log('Admin tasks already exist, skipping.');
  }

  // Create Tasks for User (only if none exist yet — idempotent)
  const userTaskCount = await prisma.task.count({ where: { userId: user.id } });
  if (userTaskCount === 0) {
    await prisma.task.create({
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

    await prisma.task.create({
      data: {
        title: 'Monthly Review',
        description: 'Analyze last months performance metrics.',
        startTime: new Date(),
        endTime: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
        userId: user.id,
        isStopped: true,
      },
    });
    console.log('User tasks created.');
  } else {
    console.log('User tasks already exist, skipping.');
  }

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
