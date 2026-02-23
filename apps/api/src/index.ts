import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import { config } from './config'
import authRoutes from './routes/auth'
import credentialRoutes from './routes/credentials'
import messageRoutes from './routes/messages'
import templateRoutes from './routes/templates'
import onboardingRoutes from './routes/onboarding'
import webhookRoutes from './routes/webhooks'
import healthRoutes from './routes/health'
import { errorHandler } from './middleware/error-handler'
import { httpLogger } from './middleware/logger'
import { httpRequestDurationMicroseconds } from './routes/health'
import { startWorkers } from './services/queue'
import path from 'path'
import fs from 'fs'

const app = express()
app.use(helmet())
app.use(cors())
app.use(express.json())
app.use(httpLogger)

// metrics middleware
app.use((req, res, next) => {
  const end = httpRequestDurationMicroseconds.startTimer()
  res.on('finish', () => end({ route: req.path, method: req.method, code: res.statusCode }))
  next()
})

app.use('/api/v1/auth', authRoutes)
app.use('/api/v1/credentials', credentialRoutes)
app.use('/api/v1/messages', messageRoutes)
app.use('/api/v1/templates', templateRoutes)
app.use('/api/v1/onboarding-links', onboardingRoutes)
app.use('/api/v1/webhooks', webhookRoutes)
app.use('/', healthRoutes)
app.get('/docs/openapi.yaml', (_req, res) => {
  const file = path.join(__dirname, '..', 'openapi.yml')
  if (fs.existsSync(file)) {
    res.type('text/yaml').send(fs.readFileSync(file, 'utf-8'))
  } else {
    res.status(404).send('Spec not found')
  }
})

app.use(errorHandler)

const worker = startWorkers()

const server = app.listen(config.port, () => {
  console.log(`API listening on ${config.port}`)
})

process.on('SIGTERM', async () => {
  await worker.close()
  server.close(() => process.exit(0))
})
