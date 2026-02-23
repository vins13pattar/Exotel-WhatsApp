import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { config } from '../config'

export interface AuthUser {
  userId: string
  tenantId: string
  role: 'ADMIN' | 'EDITOR' | 'VIEWER'
}

declare global {
  namespace Express {
    interface Request {
      authUser?: AuthUser
    }
  }
}

export function requireAuth (req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  const token = header.slice(7)
  try {
    const decoded = jwt.verify(token, config.jwtSecret) as AuthUser
    req.authUser = decoded
    next()
  } catch {
    res.status(401).json({ error: 'Unauthorized' })
  }
}

export function requireRole (roles: AuthUser['role'][]): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    if (!req.authUser) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }
    if (!roles.includes(req.authUser.role)) {
      res.status(403).json({ error: 'Forbidden' })
      return
    }
    next()
  }
}
