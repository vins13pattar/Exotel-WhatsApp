import { Router } from 'express'
import { prisma } from '../utils/db'
import { requireAuth } from '../middleware/auth'
import { z } from 'zod'
import { createHmac, timingSafeEqual } from 'crypto'
import { config } from '../config'

const router = Router()

const webhookPayloadSchema = z.object({
  whatsapp: z.object({
    messages: z.array(z.any()).optional()
  }).passthrough().optional(),
  status: z.any().optional(),
  message: z.any().optional(),
  event: z.any().optional()
}).passthrough().refine((value) => {
  const hasMessages = Array.isArray(value.whatsapp?.messages) && value.whatsapp.messages.length > 0
  return hasMessages || value.status !== undefined || value.message !== undefined || value.event !== undefined
}, {
  message: 'Webhook payload must include whatsapp.messages, status, message, or event'
})

function isValidSignature (payload: any, signature: string, secret: string): boolean {
  const computed = createHmac('sha256', secret).update(JSON.stringify(payload)).digest('hex')
  const provided = signature.trim()
  if (computed.length !== provided.length) return false
  return timingSafeEqual(Buffer.from(computed), Buffer.from(provided))
}

router.post('/exotel', async (req, res) => {
  const parsed = webhookPayloadSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

  if (config.exotelWebhookSecret) {
    const signature = req.headers['x-exotel-signature']
    if (typeof signature !== 'string' || !isValidSignature(parsed.data, signature, config.exotelWebhookSecret)) {
      return res.status(401).json({ error: 'Invalid webhook signature' })
    }
  }

  let tenantId = req.query.tenantId as string | undefined
  if (!tenantId) {
    const fallback = await prisma.tenant.findFirst()
    if (fallback) tenantId = fallback.id
    else {
      const created = await prisma.tenant.create({ data: { name: 'Public' } })
      tenantId = created.id
    }
  }

  await prisma.webhookEvent.create({
    data: {
      source: 'exotel',
      payload: parsed.data,
      tenantId
    }
  })
  res.json({ ok: true })
})

router.get('/logs', requireAuth, async (req, res) => {
  const items = await prisma.webhookEvent.findMany({
    where: { tenantId: req.authUser!.tenantId },
    orderBy: { createdAt: 'desc' },
    take: 100
  })
  res.json(items)
})

export default router
