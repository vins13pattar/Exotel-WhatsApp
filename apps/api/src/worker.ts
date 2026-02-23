import { startWorkers } from './services/queue'
import { config } from './config'

console.log('Starting worker with redis', config.redisUrl)
startWorkers()
