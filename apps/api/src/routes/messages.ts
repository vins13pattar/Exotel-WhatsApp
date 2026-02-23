import { Router } from 'express'
import { prisma } from '../utils/db'
import { requireAuth } from '../middleware/auth'
import { z } from 'zod'
import { sendQueue } from '../services/queue'

const router = Router()

const e164Phone = z.string().regex(/^\+[1-9]\d{6,14}$/, 'Phone number must be E.164 format (e.g. +14155552671)')

const exotelContentSchema = z.object({
  type: z.string().min(1)
}).passthrough()

const exotelSingleMessageSchema = z.object({
  from: e164Phone,
  to: e164Phone,
  content: exotelContentSchema
}).passthrough()

const canonicalSendSchema = z.object({
  credentialId: z.string().min(1),
  custom_data: z.union([z.string(), z.record(z.any())]).optional(),
  status_callback: z.string().url().optional(),
  whatsapp: z.object({
    messages: z.array(exotelSingleMessageSchema).min(1).max(100)
  })
})

// Backward-compatible input shape; normalized into canonical payload before sending to Exotel.
const legacySendSchema = z.object({
  credentialId: z.string().min(1),
  to: e164Phone,
  from: e164Phone.optional(),
  type: z.string().min(1),
  body: z.record(z.any()),
  custom_data: z.union([z.string(), z.record(z.any())]).optional(),
  status_callback: z.string().url().optional()
})

type SendPayload = z.infer<typeof canonicalSendSchema>

function normalizeLegacyPayload (data: z.infer<typeof legacySendSchema>): SendPayload {
  const rawBody = data.body ?? {}
  const from = data.from ?? (typeof rawBody.from === 'string' ? rawBody.from : undefined)
  if (!from || !e164Phone.safeParse(from).success) {
    throw new Error('`from` is required and must be E.164 format for legacy payloads')
  }

  const sourceContent = rawBody.content && typeof rawBody.content === 'object'
    ? { ...(rawBody.content as Record<string, any>) }
    : { ...rawBody }

  const content: z.infer<typeof exotelContentSchema> = {
    ...sourceContent,
    type: typeof sourceContent.type === 'string' && sourceContent.type.length > 0 ? sourceContent.type : data.type
  }

  return {
    credentialId: data.credentialId,
    custom_data: data.custom_data,
    status_callback: data.status_callback,
    whatsapp: {
      messages: [{ from, to: data.to, content }]
    }
  }
}

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
  let payload: SendPayload

  const canonical = canonicalSendSchema.safeParse(req.body)
  if (canonical.success) {
    payload = canonical.data
  } else {
    const legacy = legacySendSchema.safeParse(req.body)
    if (!legacy.success) {
      return res.status(400).json({
        error: 'Invalid payload',
        details: {
          canonical: canonical.error.flatten(),
          legacy: legacy.error.flatten()
        }
      })
    }

    try {
      payload = normalizeLegacyPayload(legacy.data)
    } catch (err: any) {
      return res.status(400).json({ error: err?.message ?? 'Invalid legacy payload' })
    }
  }

  const credential = await prisma.credential.findFirst({
    where: {
      id: payload.credentialId,
      tenantId: req.authUser!.tenantId
    }
  })
  if (!credential) return res.status(400).json({ error: 'Invalid credentialId for this tenant' })

  const idempotencyHeader = req.headers['idempotency-key']
  const idempotencyKey = typeof idempotencyHeader === 'string' && idempotencyHeader.trim().length > 0
    ? idempotencyHeader.trim()
    : undefined

  if (idempotencyKey) {
    const existing = await prisma.message.findFirst({
      where: { idempotencyKey, tenantId: req.authUser!.tenantId }
    })
    if (existing) {
      return res.status(200).json({ id: existing.id, status: existing.status, idempotent: true })
    }
  }

  const messages = payload.whatsapp.messages
  const first = messages[0]
  const message = await prisma.message.create({
    data: {
      idempotencyKey,
      to: messages.length > 1 ? 'bulk' : first.to,
      from: first.from,
      type: messages.length > 1 ? 'bulk' : first.content.type,
      body: {
        custom_data: payload.custom_data,
        status_callback: payload.status_callback,
        whatsapp: payload.whatsapp
      },
      credentialId: payload.credentialId,
      tenantId: req.authUser!.tenantId,
      status: 'QUEUED',
      customData: payload.custom_data ?? null
    }
  })

  await sendQueue.add('send', { messageId: message.id, credentialId: payload.credentialId })

  res.status(202).json({ id: message.id, status: message.status, queuedMessages: messages.length })
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
