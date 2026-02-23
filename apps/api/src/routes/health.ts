import { Router } from 'express'
import client from 'prom-client'

const router = Router()

const collectDefaultMetrics = client.collectDefaultMetrics
collectDefaultMetrics()

const httpRequestDurationMicroseconds = new client.Histogram({
  name: 'http_request_duration_ms',
  help: 'Duration of HTTP requests in ms',
  labelNames: ['method', 'route', 'code']
})

router.get('/healthz', (_req, res) => {
  res.json({ status: 'ok' })
})

router.get('/readyz', (_req, res) => {
  res.json({ status: 'ready' })
})

router.get('/metrics', async (_req, res) => {
  res.set('Content-Type', client.register.contentType)
  res.end(await client.register.metrics())
})

export { httpRequestDurationMicroseconds }
export default router
