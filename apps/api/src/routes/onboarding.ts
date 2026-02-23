import { Router } from 'express'
import { prisma } from '../utils/db'
import { requireAuth } from '../middleware/auth'
import { z } from 'zod'
import { createOnboardingLink, validateOnboardingToken } from '../services/exotel'

const router = Router()

router.get('/', requireAuth, async (req, res) => {
  const links = await prisma.onboardingLink.findMany({ where: { tenantId: req.authUser!.tenantId }, orderBy: { createdAt: 'desc' } })
  res.json(links)
})

router.get('/validate', requireAuth, async (req, res) => {
  const token = req.query.token as string | undefined
  const credentialId = req.query.credentialId as string | undefined
  if (!token) return res.status(400).json({ error: 'token required' })
  const cred = credentialId
    ? await prisma.credential.findUnique({ where: { id: credentialId } })
    : await prisma.credential.findFirst({ where: { tenantId: req.authUser!.tenantId } })
  if (!cred) return res.status(400).json({ error: 'Credential required' })
  try {
    const result = await validateOnboardingToken(cred, token)
    res.json(result)
  } catch (err: any) {
    res.status(502).json({ error: err?.message ?? 'Validate failed' })
  }
})

router.post('/', requireAuth, async (req, res) => {
  const schema = z.object({ count: z.number().min(1).max(5).default(1), credentialId: z.string().optional() })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

  const links = []
  const credential = parsed.data.credentialId
    ? await prisma.credential.findUnique({ where: { id: parsed.data.credentialId } })
    : await prisma.credential.findFirst({ where: { tenantId: req.authUser!.tenantId } })

  for (let i = 0; i < parsed.data.count; i++) {
    let url = 'https://example.com/onboard'
    let token = 'dummy-token'
    if (credential) {
      try {
        const result = await createOnboardingLink(credential)
        url = result?.url ?? url
        token = result?.token ?? token
      } catch {}
    }
    const link = await prisma.onboardingLink.create({
      data: {
        url,
        token,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        remainingUses: 5,
        tenantId: req.authUser!.tenantId
      }
    })
    links.push(link)
  }

  res.status(201).json(links)
})

export default router
