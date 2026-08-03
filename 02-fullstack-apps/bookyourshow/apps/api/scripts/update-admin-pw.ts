import { hash } from 'argon2';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const newPassword = 'Admin@123456!';
  const passwordHash = await hash(newPassword, {
    type: 2,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });

  const user = await prisma.user.update({
    where: { email: 'admin@bookyourshow.com' },
    data: { passwordHash },
  });

  console.log(`Admin password updated to "${newPassword}" for ${user.email}`);
  await prisma['$disconnect']();
}

main().catch(console.error);
