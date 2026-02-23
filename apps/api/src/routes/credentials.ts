import { Router } from 'express'
import { prisma } from '../utils/db'
import { requireAuth } from '../middleware/auth'
import { z } from 'zod'

const router = Router()

router.get('/', requireAuth, async (req, res) => {
  const creds = await prisma.credential.findMany({
    where: { tenantId: req.authUser!.tenantId },
    orderBy: { createdAt: 'desc' }
  })
  res.json(creds)
})

router.post('/', requireAuth, async (req, res) => {
  const schema = z.object({
    label: z.string(),
    apiKey: z.string(),
    apiToken: z.string(),
    subdomain: z.string(),
    sid: z.string(),
    region: z.string().optional()
  })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

  const cred = await prisma.credential.create({
    data: { ...parsed.data, tenantId: req.authUser!.tenantId }
  })
  res.status(201).json(cred)
})

export default router
