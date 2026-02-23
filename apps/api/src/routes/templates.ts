import { Router } from 'express'
import { prisma } from '../utils/db'
import { requireAuth } from '../middleware/auth'
import { z } from 'zod'
import { createTemplate, listTemplatesWithFilters, updateTemplate, uploadTemplateSample } from '../services/exotel'
import multer from 'multer'

const upload = multer()

const router = Router()

router.get('/', requireAuth, async (req, res) => {
  const { remote, credentialId, status, category, language, limit, before, after } = req.query

  if (remote === 'true') {
    const cred = credentialId
      ? await prisma.credential.findUnique({ where: { id: credentialId as string } })
      : await prisma.credential.findFirst({ where: { tenantId: req.authUser!.tenantId } })
    if (!cred) return res.status(400).json({ error: 'Credential required' })

    try {
      const data = await listTemplatesWithFilters(cred, {
        status: status as string | undefined,
        category: category as string | undefined,
        language: language as string | undefined,
        limit: limit as string | undefined,
        before: before as string | undefined,
        after: after as string | undefined
      })
      // optional upsert into local cache
      if (Array.isArray(data?.data)) {
        for (const t of data.data) {
          await prisma.template.upsert({
            where: { externalId: t.id ?? undefined },
            update: {
              name: t.name ?? t.id ?? 'template',
              category: t.category ?? 'UNKNOWN',
              language: t.language ?? 'en',
              status: t.status ?? 'PENDING',
              payload: t.components ?? {},
              syncedAt: new Date(),
              credentialId: cred.id,
              tenantId: req.authUser!.tenantId
            },
            create: {
              externalId: t.id ?? undefined,
              name: t.name ?? t.id ?? 'template',
              category: t.category ?? 'UNKNOWN',
              language: t.language ?? 'en',
              status: t.status ?? 'PENDING',
              payload: t.components ?? {},
              syncedAt: new Date(),
              credentialId: cred.id,
              tenantId: req.authUser!.tenantId
            }
          })
        }
      }
      res.json(data)
    } catch (err: any) {
      res.status(502).json({ error: err?.message ?? 'Failed to fetch remote templates' })
    }
    return
  }

  const templates = await prisma.template.findMany({ where: { tenantId: req.authUser!.tenantId }, orderBy: { createdAt: 'desc' } })
  res.json(templates)
})

router.post('/', requireAuth, async (req, res) => {
  const schema = z.object({
    name: z.string(),
    category: z.string(),
    language: z.string(),
    payload: z.any(),
    credentialId: z.string().optional()
  })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

  const template = await prisma.template.create({
    data: {
      name: parsed.data.name,
      category: parsed.data.category,
      language: parsed.data.language,
      payload: parsed.data.payload,
      tenantId: req.authUser!.tenantId,
      credentialId: parsed.data.credentialId ?? null,
      status: 'PENDING'
    }
  })

  if (parsed.data.credentialId) {
    const cred = await prisma.credential.findUnique({ where: { id: parsed.data.credentialId } })
    if (cred) {
      try {
        const result = await createTemplate(cred, {
          name: parsed.data.name,
          category: parsed.data.category,
          language: parsed.data.language,
          components: parsed.data.payload?.components ?? []
        })
        await prisma.template.update({ where: { id: template.id }, data: { externalId: result?.id ?? null, status: 'APPROVED' } })
      } catch (err: any) {
        await prisma.template.update({ where: { id: template.id }, data: { status: 'PENDING' } })
      }
    }
  }

  res.status(201).json(template)
})

router.put('/:id', requireAuth, async (req, res) => {
  const schema = z.object({
    name: z.string().optional(),
    category: z.string().optional(),
    language: z.string().optional(),
    payload: z.any().optional(),
    credentialId: z.string().optional()
  })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

  const existing = await prisma.template.findFirst({ where: { id: req.params.id, tenantId: req.authUser!.tenantId } })
  if (!existing) return res.status(404).json({ error: 'Not found' })

  const updated = await prisma.template.update({
    where: { id: req.params.id },
    data: {
      name: parsed.data.name ?? existing.name,
      category: parsed.data.category ?? existing.category,
      language: parsed.data.language ?? existing.language,
      payload: parsed.data.payload ?? existing.payload
    }
  })

  const cred = parsed.data.credentialId
    ? await prisma.credential.findUnique({ where: { id: parsed.data.credentialId } })
    : existing.credentialId
      ? await prisma.credential.findUnique({ where: { id: existing.credentialId } })
      : await prisma.credential.findFirst({ where: { tenantId: req.authUser!.tenantId } })

  if (cred && existing.externalId) {
    try {
      await updateTemplate(cred, existing.externalId, {
        name: updated.name,
        category: updated.category,
        language: updated.language,
        components: updated.payload?.components ?? []
      })
    } catch {}
  }

  res.json(updated)
})

router.post('/upload-sample', requireAuth, upload.single('file'), async (req, res) => {
  const credentialId = req.body.credentialId as string | undefined
  if (!req.file) return res.status(400).json({ error: 'file required' })
  const cred = credentialId
    ? await prisma.credential.findUnique({ where: { id: credentialId } })
    : await prisma.credential.findFirst({ where: { tenantId: req.authUser!.tenantId } })
  if (!cred) return res.status(400).json({ error: 'Credential required' })

  try {
    const result = await uploadTemplateSample(cred, { buffer: req.file.buffer, length: req.file.size, mime: req.file.mimetype })
    res.json(result)
  } catch (err: any) {
    res.status(502).json({ error: err?.message ?? 'Upload failed' })
  }
})

export default router
