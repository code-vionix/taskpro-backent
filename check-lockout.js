
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const users = await prisma.user.findMany({
        select: { email: true, failedAttempts: true, lockoutUntil: true }
    });
    console.log(JSON.stringify(users, null, 2));
  } catch (e) {
    console.error('Failed to fetch users:', e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
