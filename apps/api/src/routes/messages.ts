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
  status_callback: z.string().url().refine((value) => /^https?:\/\//i.test(value), 'status_callback must be http(s) URL').optional(),
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
  status_callback: z.string().url().refine((value) => /^https?:\/\//i.test(value), 'status_callback must be http(s) URL').optional()
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

function validateContentByType (content: Record<string, any>): string | null {
  const type = String(content.type ?? '').toLowerCase()

  if (type === 'text') {
    const body = content?.text?.body
    if (typeof body !== 'string' || body.trim().length === 0) return 'content.text.body is required when content.type=text'
    return null
  }

  if (type === 'image' || type === 'audio' || type === 'video' || type === 'document' || type === 'sticker') {
    const media = content?.[type]
    if (!media || typeof media !== 'object' || typeof media.link !== 'string' || !/^https?:\/\//i.test(media.link)) {
      return `content.${type}.link (http/https URL) is required when content.type=${type}`
    }
    return null
  }

  if (type === 'location') {
    const location = content?.location
    if (!location || typeof location !== 'object') return 'content.location is required when content.type=location'
    if (typeof location.latitude !== 'string' || location.latitude.trim().length === 0) return 'content.location.latitude is required'
    if (typeof location.longitude !== 'string' || location.longitude.trim().length === 0) return 'content.location.longitude is required'
    return null
  }

  if (type === 'contacts') {
    const contacts = content?.contacts
    if (!Array.isArray(contacts) || contacts.length === 0) return 'content.contacts[] is required when content.type=contacts'
    return null
  }

  if (type === 'interactive') {
    const interactive = content?.interactive
    if (!interactive || typeof interactive !== 'object') return 'content.interactive is required when content.type=interactive'
    const interactiveType = String(interactive.type ?? '').toLowerCase()
    if (!['button', 'list', 'flow'].includes(interactiveType)) {
      return 'content.interactive.type must be one of: button, list, flow'
    }
    if (!interactive.body || typeof interactive.body !== 'object' || typeof interactive.body.text !== 'string' || interactive.body.text.trim().length === 0) {
      return 'content.interactive.body.text is required when content.type=interactive'
    }
    if (!interactive.action || typeof interactive.action !== 'object') {
      return 'content.interactive.action is required when content.type=interactive'
    }
    return null
  }

  if (type === 'template') {
    const template = content?.template
    if (!template || typeof template !== 'object') return 'content.template is required when content.type=template'
    if (typeof template.namespace !== 'string' || template.namespace.trim().length === 0) return 'content.template.namespace is required'
    if (typeof template.name !== 'string' || template.name.trim().length === 0) return 'content.template.name is required'
    if (!template.language || typeof template.language !== 'object') return 'content.template.language is required'
    if (!Array.isArray(template.components)) return 'content.template.components[] is required'
    return null
  }

  return null
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
  for (const msg of messages) {
    const error = validateContentByType(msg.content as Record<string, any>)
    if (error) return res.status(400).json({ error })
  }
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
