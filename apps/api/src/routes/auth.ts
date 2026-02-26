import { Router } from 'express'
import { prisma } from '../utils/db'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { config } from '../config'
import { requireAuth } from '../middleware/auth'

const router = Router()

router.post('/login', async (req, res) => {
  const { email, password } = req.body
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) return res.status(401).json({ error: 'Invalid credentials' })
  const ok = await bcrypt.compare(password, user.password)
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' })

  const token = jwt.sign({ userId: user.id, tenantId: user.tenantId, role: user.role }, config.jwtSecret, { expiresIn: '12h' })
  res.json({ token })
})

router.post('/refresh', async (req, res) => {
  const { token } = req.body
  try {
    const decoded = jwt.verify(token, config.jwtSecret) as any
    const newToken = jwt.sign({ userId: decoded.userId, tenantId: decoded.tenantId, role: decoded.role }, config.jwtSecret, { expiresIn: '12h' })
    res.json({ token: newToken })
  } catch {
    res.status(401).json({ error: 'Invalid token' })
  }
})

router.get('/me', requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.authUser!.userId },
    select: { id: true, email: true, role: true, tenantId: true }
  })
  if (!user) return res.status(404).json({ error: 'User not found' })
  res.json(user)
})

export default router
