import { config } from '../config'
import { logger } from '../utils/logger'
import { Credential } from '@prisma/client'
import { request } from 'undici'

function buildAuthHeader (cred: Credential): string {
  const token = Buffer.from(`${cred.apiKey}:${cred.apiToken}`).toString('base64')
  return `Basic ${token}`
}

function baseUrl (cred: Credential): string {
  return `https://${cred.subdomain}.${cred.region ?? config.exotelRegion}`
}

export async function sendMessage (cred: Credential, payload: any) {
  const url = `${baseUrl(cred)}/v2/accounts/${cred.sid}/messages`
  const res = await request(url, {
    method: 'POST',
    headers: {
      Authorization: buildAuthHeader(cred),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  })
  const data = await res.body.json()
  if (res.statusCode >= 400) {
    logger.error({ data }, 'Exotel sendMessage error')
    throw new Error(data?.message ?? 'Failed to send message')
  }
  return data
}

export async function listTemplates (cred: Credential) {
  const url = `${baseUrl(cred)}/v2/accounts/${cred.sid}/templates`
  const res = await request(url, {
    method: 'GET',
    headers: { Authorization: buildAuthHeader(cred) }
  })
  const data = await res.body.json()
  if (res.statusCode >= 400) throw new Error(data?.message ?? 'Failed to list templates')
  return data
}

export async function createTemplate (cred: Credential, payload: any) {
  const url = `${baseUrl(cred)}/v2/accounts/${cred.sid}/templates`
  const res = await request(url, {
    method: 'POST',
    headers: {
      Authorization: buildAuthHeader(cred),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  })
  const data = await res.body.json()
  if (res.statusCode >= 400) throw new Error(data?.message ?? 'Failed to create template')
  return data
}

export async function createOnboardingLink (cred: Credential) {
  const url = `${baseUrl(cred)}/v2/accounts/${cred.sid}/isv`
  const res = await request(url, {
    method: 'POST',
    headers: {
      Authorization: buildAuthHeader(cred),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({})
  })
  const data = await res.body.json()
  if (res.statusCode >= 400) throw new Error(data?.message ?? 'Failed to create onboarding link')
  return data
}
