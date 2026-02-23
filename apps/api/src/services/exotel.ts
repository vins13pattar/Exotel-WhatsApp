import { config } from '../config'
import { logger } from '../utils/logger'
import { Credential } from '@prisma/client'
import { request } from 'undici'
import { URLSearchParams } from 'url'

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

export async function listTemplatesWithFilters (cred: Credential, params: Record<string, string | undefined>) {
  const qs = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => { if (v) qs.append(k, v) })
  const url = `${baseUrl(cred)}/v2/accounts/${cred.sid}/templates?${qs.toString()}`
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

export async function updateTemplate (cred: Credential, templateId: string, payload: any) {
  const url = `${baseUrl(cred)}/v2/accounts/${cred.sid}/templates/${templateId}`
  const res = await request(url, {
    method: 'PUT',
    headers: {
      Authorization: buildAuthHeader(cred),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  })
  const data = await res.body.json()
  if (res.statusCode >= 400) throw new Error(data?.message ?? 'Failed to update template')
  return data
}

export async function uploadTemplateSample (cred: Credential, file: { buffer: Buffer, length: number, mime: string }) {
  const qs = new URLSearchParams({ file_length: String(file.length), file_type: file.mime })
  const url = `${baseUrl(cred)}/v2/accounts/${cred.sid}/templates/sample?${qs.toString()}`
  const res = await request(url, {
    method: 'POST',
    headers: {
      Authorization: buildAuthHeader(cred),
      'Content-Type': file.mime,
      'Content-Length': String(file.length)
    },
    body: file.buffer
  })
  const data = await res.body.json()
  if (res.statusCode >= 400) throw new Error(data?.message ?? 'Failed to upload sample')
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

export async function validateOnboardingToken (cred: Credential, token: string) {
  const url = `${baseUrl(cred)}/v2/accounts/${cred.sid}/isv?access_token=${encodeURIComponent(token)}`
  const res = await request(url, {
    method: 'GET',
    headers: { Authorization: buildAuthHeader(cred) }
  })
  const data = await res.body.json()
  if (res.statusCode >= 400) throw new Error(data?.message ?? 'Failed to validate onboarding token')
  return data
}
