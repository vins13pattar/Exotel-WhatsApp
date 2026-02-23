import { Router } from 'express'
import { prisma } from '../utils/db'
import { requireAuth } from '../middleware/auth'
import { z } from 'zod'
import { sendQueue } from '../services/queue'

const router = Router()

router.get('/', requireAuth, async (req, res) => {
  const items = await prisma.message.findMany({
    where: { tenantId: req.authUser!.tenantId },
    orderBy: { createdAt: 'desc' },
    take: 50
  })
  res.json(items)
})

router.post('/', requireAuth, async (req, res) => {
  const schema = z.object({
    to: z.string(),
    type: z.string(),
    body: z.any(),
    credentialId: z.string()
  })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

  const message = await prisma.message.create({
    data: {
      to: parsed.data.to,
      type: parsed.data.type,
      body: parsed.data.body,
      credentialId: parsed.data.credentialId,
      tenantId: req.authUser!.tenantId,
      status: 'QUEUED'
    }
  })

  await sendQueue.add('send', { messageId: message.id, credentialId: parsed.data.credentialId })

  res.status(202).json({ id: message.id, status: message.status })
})

router.post('/:id/cancel', requireAuth, async (req, res) => {
  const { id } = req.params
  const msg = await prisma.message.findFirst({ where: { id, tenantId: req.authUser!.tenantId } })
  if (!msg) return res.status(404).json({ error: 'Not found' })
  if (msg.status !== 'QUEUED') return res.status(400).json({ error: 'Cannot cancel' })
  await prisma.message.update({ where: { id }, data: { status: 'CANCELLED' } })
  res.json({ status: 'CANCELLED' })
})

export default router
