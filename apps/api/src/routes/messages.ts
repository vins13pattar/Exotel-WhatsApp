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

router.get('/:id', requireAuth, async (req, res) => {
  const { id } = req.params
  const msg = await prisma.message.findFirst({ where: { id, tenantId: req.authUser!.tenantId } })
  if (!msg) return res.status(404).json({ error: 'Not found' })
  res.json(msg)
})

router.post('/', requireAuth, async (req, res) => {
  const singleSchema = z.object({
    to: z.string(),
    type: z.string(),
    body: z.any(),
    credentialId: z.string(),
    status_callback: z.string().url().optional(),
    custom_data: z.any().optional()
  })

  const bulkSchema = z.object({
    credentialId: z.string(),
    whatsapp: z.object({
      messages: z.array(z.any()).min(1)
    }),
    status_callback: z.string().url().optional()
  })

  const isBulk = typeof req.body?.whatsapp?.messages !== 'undefined'
  if (isBulk) {
    const parsed = bulkSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })
    const bulkMessage = await prisma.message.create({
      data: {
        to: 'bulk',
        type: 'bulk',
        body: { whatsapp: parsed.data.whatsapp, status_callback: parsed.data.status_callback },
        credentialId: parsed.data.credentialId,
        tenantId: req.authUser!.tenantId,
        status: 'QUEUED'
      }
    })
    await sendQueue.add('send', { messageId: bulkMessage.id, credentialId: parsed.data.credentialId })
    res.status(202).json({ id: bulkMessage.id, status: 'QUEUED' })
    return
  }

  const parsed = singleSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

  const message = await prisma.message.create({
    data: {
      to: parsed.data.to,
      type: parsed.data.type,
      body: { ...parsed.data.body, custom_data: parsed.data.custom_data, status_callback: parsed.data.status_callback },
      credentialId: parsed.data.credentialId,
      tenantId: req.authUser!.tenantId,
      status: 'QUEUED',
      customData: parsed.data.custom_data ?? null
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
