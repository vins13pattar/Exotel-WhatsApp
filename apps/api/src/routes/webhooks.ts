import { Router } from 'express'
import { prisma } from '../utils/db'
import { requireAuth } from '../middleware/auth'

const router = Router()

router.post('/exotel', async (req, res) => {
  let tenantId = req.query.tenantId as string | undefined
  if (!tenantId) {
    const fallback = await prisma.tenant.findFirst()
    if (fallback) tenantId = fallback.id
    else {
      const created = await prisma.tenant.create({ data: { name: 'Public' } })
      tenantId = created.id
    }
  }
  const payload = req.body
  await prisma.webhookEvent.create({
    data: {
      source: 'exotel',
      payload,
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
