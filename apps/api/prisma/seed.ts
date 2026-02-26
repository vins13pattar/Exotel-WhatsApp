import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main () {
  const existing = await prisma.tenant.findFirst({ where: { name: 'Demo Tenant' } })
  const tenant = existing ?? await prisma.tenant.create({ data: { name: 'Demo Tenant' } })

  const adminEmail = 'admin@example.com'
  const passwordHash = await bcrypt.hash('changeme', 10)

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      password: passwordHash,
      role: 'ADMIN',
      tenantId: tenant.id
    }
  })

  console.log('Seeded tenant and admin user (admin@example.com / changeme)')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
