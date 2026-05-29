
import { NextRequest } from 'next/server'

const PROVIDER_BASE_URLS: Record<string, string> = {
  'mail.tm': 'https://api.mail.tm',
  'mail.gw': 'https://api.mail.gw',
}

function getBaseUrl(provider?: string | null): string {
  if (provider && PROVIDER_BASE_URLS[provider]) return PROVIDER_BASE_URLS[provider]
  return 'https://api.mail.tm'
}

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 15000): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timeoutId)
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { accountId, token, provider } = await req.json()

    if (!accountId || !token) {
      return new Response(JSON.stringify({ error: 'Account ID and token are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const baseUrl = getBaseUrl(provider)

    try {
      const response = await fetchWithTimeout(`${baseUrl}/accounts/${accountId}`, {
        method: 'DELETE',
        headers: {
          'Accept': 'application/ld+json',
          'Authorization': `Bearer ${token}`,
        },
      })

      // 204 = success, 404 = already deleted
      if (response.status === 204 || response.status === 404) {
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      if (!response.ok) {
        return new Response(JSON.stringify({ error: 'Failed to delete account' }), {
          status: response.status,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return new Response(JSON.stringify({ error: 'Delete request timed out' }), {
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
