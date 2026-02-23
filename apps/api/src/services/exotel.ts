import { config } from '../config'
import { logger } from '../utils/logger'
import { request } from 'undici'
import { URLSearchParams } from 'url'

type ExotelCredential = {
  apiKey: string
  apiToken: string
  subdomain: string
  region: string | null
  sid: string
}

function buildAuthHeader (cred: ExotelCredential): string {
  const token = Buffer.from(`${cred.apiKey}:${cred.apiToken}`).toString('base64')
  return `Basic ${token}`
}

function baseUrl (cred: ExotelCredential): string {
  return `https://${cred.subdomain}.${cred.region ?? config.exotelRegion}`
}

function templateUrl (cred: ExotelCredential, wabaId: string, extra?: Record<string, string | undefined>): string {
  const qs = new URLSearchParams({ waba_id: wabaId })
  if (extra) {
    Object.entries(extra).forEach(([k, v]) => {
      if (v) qs.append(k, v)
    })
  }
  return `${baseUrl(cred)}/v2/accounts/${cred.sid}/templates?${qs.toString()}`
}

async function parseResponse (res: Awaited<ReturnType<typeof request>>): Promise<any> {
  const contentType = res.headers['content-type'] ?? ''
  try {
    if (contentType.includes('application/json')) {
      return await res.body.json()
    }
    return await res.body.text()
  } catch {
    return null
  }
}

function extractErrorMessage (data: any, fallback: string): string {
  if (typeof data === 'string' && data.trim().length > 0) return data
  if (data?.message) return String(data.message)
  if (data?.error?.message) return String(data.error.message)
  return fallback
}

export async function sendMessage (cred: ExotelCredential, payload: any) {
  const url = `${baseUrl(cred)}/v2/accounts/${cred.sid}/messages`
  const res = await request(url, {
    method: 'POST',
    headers: {
      Authorization: buildAuthHeader(cred),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  })
  const data = await parseResponse(res)
  if (res.statusCode >= 400) {
    logger.error({ statusCode: res.statusCode, data }, 'Exotel sendMessage error')
    throw new Error(extractErrorMessage(data, 'Failed to send message'))
  }
  return data
}

export async function listTemplatesWithFilters (
  cred: ExotelCredential,
  wabaId: string,
  params: Record<string, string | undefined>
) {
  const url = templateUrl(cred, wabaId, params)
  const res = await request(url, {
    method: 'GET',
    headers: { Authorization: buildAuthHeader(cred) }
  })
  const data = await parseResponse(res)
  if (res.statusCode >= 400) throw new Error(extractErrorMessage(data, 'Failed to list templates'))
  return data
}

export async function createTemplate (cred: ExotelCredential, wabaId: string, payload: any) {
  const url = templateUrl(cred, wabaId)
  const res = await request(url, {
    method: 'POST',
    headers: {
      Authorization: buildAuthHeader(cred),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  })
  const data = await parseResponse(res)
  if (res.statusCode >= 400) throw new Error(extractErrorMessage(data, 'Failed to create template'))
  return data
}

export async function updateTemplate (cred: ExotelCredential, wabaId: string, payload: any) {
  const url = templateUrl(cred, wabaId)
  const res = await request(url, {
    method: 'PUT',
    headers: {
      Authorization: buildAuthHeader(cred),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  })
  const data = await parseResponse(res)
  if (res.statusCode >= 400) throw new Error(extractErrorMessage(data, 'Failed to update template'))
  return data
}

export async function deleteTemplates (cred: ExotelCredential, wabaId: string, payload: any) {
  const url = templateUrl(cred, wabaId)
  const res = await request(url, {
    method: 'DELETE',
    headers: {
      Authorization: buildAuthHeader(cred),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  })
  const data = await parseResponse(res)
  if (res.statusCode >= 400) throw new Error(extractErrorMessage(data, 'Failed to delete templates'))
  return data
}

export async function uploadTemplateSample (cred: ExotelCredential, file: { buffer: Buffer, length: number, mime: string }) {
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
  const data = await parseResponse(res)
  if (res.statusCode >= 400) throw new Error(extractErrorMessage(data, 'Failed to upload sample'))
  return data
}

export async function createOnboardingLink (cred: ExotelCredential) {
  const url = `${baseUrl(cred)}/v2/accounts/${cred.sid}/isv`
  const res = await request(url, {
    method: 'POST',
    headers: {
      Authorization: buildAuthHeader(cred),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({})
  })
  const data = await parseResponse(res)
  if (res.statusCode >= 400) throw new Error(extractErrorMessage(data, 'Failed to create onboarding link'))
  return data
}

export async function validateOnboardingToken (cred: ExotelCredential, token: string) {
  const url = `${baseUrl(cred)}/v2/accounts/${cred.sid}/isv?access_token=${encodeURIComponent(token)}`
  const res = await request(url, {
    method: 'GET',
    headers: { Authorization: buildAuthHeader(cred) }
  })
  const data = await parseResponse(res)
  if (res.statusCode >= 400) throw new Error(extractErrorMessage(data, 'Failed to validate onboarding token'))
  return data
}
