import { Router } from 'express'
import { prisma } from '../utils/db'
import { requireAuth } from '../middleware/auth'
import { z } from 'zod'
import { createTemplate } from '../services/exotel'

const router = Router()

router.get('/', requireAuth, async (req, res) => {
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

export default router
