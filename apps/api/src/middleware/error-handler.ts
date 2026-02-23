import { NextFunction, Request, Response } from 'express'
import { logger } from '../utils/logger'

export function errorHandler (err: any, _req: Request, res: Response, _next: NextFunction): void {
  logger.error({ err }, 'Unhandled error')
  res.status(500).json({ error: 'Internal Server Error' })
}
