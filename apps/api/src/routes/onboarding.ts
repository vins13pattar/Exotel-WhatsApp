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
    ? await prisma.credential.findFirst({ where: { id: credentialId, tenantId: req.authUser!.tenantId } })
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
  const schema = z.object({ count: z.number().int().min(1).max(50).default(1), credentialId: z.string().optional() })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

  const links = []
  const credential = parsed.data.credentialId
    ? await prisma.credential.findFirst({ where: { id: parsed.data.credentialId, tenantId: req.authUser!.tenantId } })
    : await prisma.credential.findFirst({ where: { tenantId: req.authUser!.tenantId } })
  if (!credential) return res.status(400).json({ error: 'Credential required' })

  for (let i = 0; i < parsed.data.count; i++) {
    const result = await createOnboardingLink(credential)
    // Probe all documented field paths: top-level, data-wrapped, and nested response.whatsapp.isv.data
    const isvData = result?.response?.whatsapp?.isv?.data
    const url = result?.url ?? result?.onboarding_url ??
      result?.data?.url ?? result?.data?.onboarding_url ??
      isvData?.url ?? isvData?.onboarding_url
    const token = result?.token ?? result?.access_token ??
      result?.data?.token ?? result?.data?.access_token ??
      isvData?.token ?? isvData?.access_token
    if (!url || !token) return res.status(502).json({ error: 'Exotel onboarding response missing onboarding_url/access_token' })
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
