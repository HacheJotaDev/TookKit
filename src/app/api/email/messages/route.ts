
import { NextRequest } from 'next/server'

// Provider base URLs
const PROVIDER_BASE_URLS: Record<string, string> = {
  'mail.tm': 'https://api.mail.tm',
  'mail.gw': 'https://api.mail.gw',
}

function getBaseUrl(provider?: string | null): string {
  if (provider && PROVIDER_BASE_URLS[provider]) {
    return PROVIDER_BASE_URLS[provider]
  }
  return 'https://api.mail.tm'
}

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 15000): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    })
    return response
  } finally {
    clearTimeout(timeoutId)
  }
}

export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '')
    const provider = req.headers.get('X-Mail-Provider') || req.nextUrl.searchParams.get('provider')

    if (!token) {
      return new Response(JSON.stringify({ error: 'Token is required' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const baseUrl = getBaseUrl(provider)

    try {
      const response = await fetchWithTimeout(`${baseUrl}/messages`, {
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        return new Response(JSON.stringify({ error: 'Failed to fetch messages', status: response.status }), {
          status: response.status,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      const data = await response.json()

      return new Response(JSON.stringify(data), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return new Response(JSON.stringify({ error: 'Messages request timed out' }), {
          status: 504,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      throw err
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
