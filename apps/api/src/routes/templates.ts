import { Router } from 'express'
import { prisma } from '../utils/db'
import { requireAuth } from '../middleware/auth'
import { z } from 'zod'
import { createTemplate, deleteTemplates, listTemplatesWithFilters, updateTemplate, uploadTemplateSample } from '../services/exotel'
import multer from 'multer'

const upload = multer()
const router = Router()

const remoteListQuerySchema = z.object({
  remote: z.enum(['true', 'false']).optional(),
  credentialId: z.string().optional(),
  wabaId: z.string().optional(),
  status: z.string().optional(),
  category: z.string().optional(),
  language: z.string().optional(),
  limit: z.string().optional(),
  before: z.string().optional(),
  after: z.string().optional()
})

const templateWriteSchema = z.object({
  name: z.string(),
  category: z.string(),
  language: z.string(),
  payload: z.record(z.any()),
  credentialId: z.string().optional(),
  wabaId: z.string().optional()
})

const templateUpdateSchema = z.object({
  name: z.string().optional(),
  category: z.string().optional(),
  language: z.string().optional(),
  payload: z.record(z.any()).optional(),
  credentialId: z.string().optional(),
  wabaId: z.string().optional()
})

const templateDeleteSchema = z.object({
  credentialId: z.string(),
  wabaId: z.string(),
  payload: z.object({
    whatsapp: z.object({
      templates: z.array(z.any()).min(1)
    })
  }).passthrough()
})

function normalizeTemplateStatus (value: unknown): 'PENDING' | 'APPROVED' | 'REJECTED' | 'DISABLED' {
  const normalized = String(value ?? 'PENDING').toUpperCase()
  if (normalized === 'APPROVED' || normalized === 'REJECTED' || normalized === 'DISABLED') return normalized
  return 'PENDING'
}

async function findTenantCredential (credentialId: string, tenantId: string) {
  return await prisma.credential.findFirst({
    where: {
      id: credentialId,
      tenantId
    }
  })
}

function requireRemoteConfig (credentialId?: string, wabaId?: string): { ok: true } | { ok: false, error: string } {
  if (!credentialId && !wabaId) return { ok: true }
  if (!credentialId || !wabaId) return { ok: false, error: '`credentialId` and `wabaId` must be provided together for Exotel template sync' }
  return { ok: true }
}

router.get('/', requireAuth, async (req, res) => {
  const parsedQuery = remoteListQuerySchema.safeParse(req.query)
  if (!parsedQuery.success) return res.status(400).json({ error: parsedQuery.error.flatten() })

  const { remote, credentialId, wabaId, status, category, language, limit, before, after } = parsedQuery.data

  if (remote === 'true') {
    if (!credentialId || !wabaId) {
      return res.status(400).json({ error: '`credentialId` and `wabaId` are required when remote=true' })
    }

    const cred = await findTenantCredential(credentialId, req.authUser!.tenantId)
    if (!cred) return res.status(400).json({ error: 'Credential not found for this tenant' })

    try {
      const data = await listTemplatesWithFilters(cred, wabaId, { status, category, language, limit, before, after })
      const rows = Array.isArray(data?.data)
        ? data.data
        : Array.isArray(data?.whatsapp?.templates)
          ? data.whatsapp.templates
          : []

      for (const row of rows) {
        const externalId = typeof row?.id === 'string' && row.id.length > 0 ? row.id : null
        const payload = row?.components && typeof row.components === 'object' ? { components: row.components } : row

        if (externalId) {
          await prisma.template.upsert({
            where: { externalId },
            update: {
              name: row?.name ?? externalId,
              category: row?.category ?? 'UNKNOWN',
              language: row?.language ?? 'en',
              status: normalizeTemplateStatus(row?.status),
              payload,
              syncedAt: new Date(),
              credentialId: cred.id,
              tenantId: req.authUser!.tenantId
            },
            create: {
              externalId,
              name: row?.name ?? externalId,
              category: row?.category ?? 'UNKNOWN',
              language: row?.language ?? 'en',
              status: normalizeTemplateStatus(row?.status),
              payload,
              syncedAt: new Date(),
              credentialId: cred.id,
              tenantId: req.authUser!.tenantId
            }
          })
          continue
        }

        await prisma.template.create({
          data: {
            name: row?.name ?? 'template',
            category: row?.category ?? 'UNKNOWN',
            language: row?.language ?? 'en',
            status: normalizeTemplateStatus(row?.status),
            payload,
            syncedAt: new Date(),
            credentialId: cred.id,
            tenantId: req.authUser!.tenantId
          }
        })
      }

      return res.json(data)
    } catch (err: any) {
      return res.status(502).json({ error: err?.message ?? 'Failed to fetch remote templates' })
    }
  }

  const templates = await prisma.template.findMany({
    where: { tenantId: req.authUser!.tenantId },
    orderBy: { createdAt: 'desc' }
  })
  return res.json(templates)
})

router.post('/', requireAuth, async (req, res) => {
  const parsed = templateWriteSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

  const remoteConfig = requireRemoteConfig(parsed.data.credentialId, parsed.data.wabaId)
  if (!remoteConfig.ok) return res.status(400).json({ error: remoteConfig.error })

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

  if (parsed.data.credentialId && parsed.data.wabaId) {
    const cred = await findTenantCredential(parsed.data.credentialId, req.authUser!.tenantId)
    if (!cred) return res.status(400).json({ error: 'Credential not found for this tenant' })

    try {
      const result = await createTemplate(cred, parsed.data.wabaId, parsed.data.payload)
      await prisma.template.update({
        where: { id: template.id },
        data: {
          externalId: result?.id ?? result?.data?.id ?? null,
          status: normalizeTemplateStatus(result?.status ?? 'PENDING'),
          syncedAt: new Date()
        }
      })
    } catch (err: any) {
      return res.status(502).json({ error: err?.message ?? 'Failed to create template in Exotel' })
    }
  }

  return res.status(201).json(template)
})

router.put('/:id', requireAuth, async (req, res) => {
  const parsed = templateUpdateSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

  const remoteConfig = requireRemoteConfig(parsed.data.credentialId, parsed.data.wabaId)
  if (!remoteConfig.ok) return res.status(400).json({ error: remoteConfig.error })

  const existing = await prisma.template.findFirst({ where: { id: req.params.id, tenantId: req.authUser!.tenantId } })
  if (!existing) return res.status(404).json({ error: 'Not found' })

  const updated = await prisma.template.update({
    where: { id: req.params.id },
    data: {
      name: parsed.data.name ?? existing.name,
      category: parsed.data.category ?? existing.category,
      language: parsed.data.language ?? existing.language,
      payload: parsed.data.payload ?? (existing.payload as any)
    }
  })

  if (parsed.data.credentialId && parsed.data.wabaId) {
    const cred = await findTenantCredential(parsed.data.credentialId, req.authUser!.tenantId)
    if (!cred) return res.status(400).json({ error: 'Credential not found for this tenant' })

    try {
      await updateTemplate(cred, parsed.data.wabaId, parsed.data.payload ?? updated.payload)
      await prisma.template.update({ where: { id: updated.id }, data: { syncedAt: new Date() } })
    } catch (err: any) {
      return res.status(502).json({ error: err?.message ?? 'Failed to update template in Exotel' })
    }
  }

  return res.json(updated)
})

router.delete('/', requireAuth, async (req, res) => {
  const parsed = templateDeleteSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

  const cred = await findTenantCredential(parsed.data.credentialId, req.authUser!.tenantId)
  if (!cred) return res.status(400).json({ error: 'Credential not found for this tenant' })

  try {
    const result = await deleteTemplates(cred, parsed.data.wabaId, parsed.data.payload)

    const templateNames = parsed.data.payload.whatsapp.templates
      .map((item: any) => item?.template?.name)
      .filter((name: any) => typeof name === 'string' && name.length > 0)

    if (templateNames.length > 0) {
      await prisma.template.updateMany({
        where: {
          tenantId: req.authUser!.tenantId,
          name: { in: templateNames }
        },
        data: {
          status: 'DISABLED',
          syncedAt: new Date()
        }
      })
    }

    return res.json(result)
  } catch (err: any) {
    return res.status(502).json({ error: err?.message ?? 'Failed to delete templates in Exotel' })
  }
})

router.post('/upload-sample', requireAuth, upload.single('file'), async (req, res) => {
  const credentialId = req.body.credentialId as string | undefined
  if (!req.file) return res.status(400).json({ error: 'file required' })
  if (!credentialId) return res.status(400).json({ error: 'credentialId required' })

  const cred = await findTenantCredential(credentialId, req.authUser!.tenantId)
  if (!cred) return res.status(400).json({ error: 'Credential not found for this tenant' })

  try {
    const result = await uploadTemplateSample(cred, {
      buffer: req.file.buffer,
      length: req.file.size,
      mime: req.file.mimetype
    })
    return res.json(result)
  } catch (err: any) {
    return res.status(502).json({ error: err?.message ?? 'Upload failed' })
  }
})

export default router
