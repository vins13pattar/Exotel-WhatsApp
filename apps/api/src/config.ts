import dotenv from 'dotenv'

dotenv.config()

export const config = {
  port: Number(process.env.PORT ?? 4000),
  jwtSecret: process.env.JWT_SECRET ?? 'changeme',
  databaseUrl: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/exotel_whatsapp',
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
  exotelRegion: process.env.EXOTEL_REGION ?? 'api.exotel.com',
  exotelWebhookSecret: process.env.EXOTEL_WEBHOOK_SECRET
}
