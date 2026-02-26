import { Queue, Worker, Job } from 'bullmq'
import { config } from '../config'
import IORedis from 'ioredis'
import { prisma } from '../utils/db'
import { sendMessage } from './exotel'
import { logger } from '../utils/logger'

const connection = new IORedis(config.redisUrl, { maxRetriesPerRequest: null })

export const sendQueue = new Queue('send-messages', { connection })

export type SendJob = {
  messageId: string
  credentialId: string
}

export function startWorkers () {
  const worker = new Worker<SendJob>('send-messages', async (job: Job<SendJob>) => {
    const message = await prisma.message.findUnique({ where: { id: job.data.messageId } })
    if (!message) return
    if (message.status === 'CANCELLED') return
    const credential = await prisma.credential.findUnique({ where: { id: job.data.credentialId } })
    if (!credential) throw new Error('Credential not found')

    try {
      await prisma.message.update({
        where: { id: message.id },
        data: { status: 'SENDING' }
      })
      const payload = message.body as any
      const result = await sendMessage(credential, payload)
      const externalId = result?.id ??
        result?.data?.id ??
        result?.data?.messages?.[0]?.id ??
        result?.messages?.[0]?.id ??
        null
      await prisma.message.update({
        where: { id: message.id },
        data: { status: 'SENT', externalId, sentAt: new Date() }
      })
    } catch (err: any) {
      logger.error({ err }, 'Send job failed')
      await prisma.message.update({
        where: { id: message.id },
        data: { status: 'FAILED', failedReason: err?.message }
      })
      throw err
    }
  }, { connection })

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Job failed')
  })

  return worker
}
