import { PrismaClient } from '@prisma/client'
import { logger } from './logger'

const prisma = new PrismaClient({
  log: ['error', 'warn']
})

prisma.$on('error', (e: any) => {
  logger.error({ prisma: e }, 'Prisma error')
})

export { prisma }
