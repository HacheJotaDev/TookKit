import { NextRequest, NextResponse } from 'next/server'
import http from 'node:http'

/**
 * POST — Validate a list of proxy servers.
 * Body: { proxies: string[] }  — each "ip:port" or "ip:port:user:pass"
 * Returns: { valid: string[], invalid: string[] }
 */

interface ProxyParts {
  host: string
  port: number
  auth?: string
}

export function parseProxy(proxy: string): ProxyParts | null {
  const parts = proxy.trim().split(':')
  if (parts.length < 2) return null
  const host = parts[0]
  const port = parseInt(parts[1], 10)
  if (!host || isNaN(port) || port < 1 || port > 65535) return null
  const auth = parts.length >= 4 ? `${parts[2]}:${parts.slice(3).join(':')}` : undefined
  return { host, port, auth }
}

function testProxy(proxy: ProxyParts): Promise<boolean> {
  return new Promise((resolve) => {
    const testUrl = 'http://example.com/'
    const urlObj = new URL(testUrl)

    const options: http.RequestOptions = {
      hostname: proxy.host,
      port: proxy.port,
      path: testUrl,
      method: 'GET',
      timeout: 8000,
      headers: {
        'Host': urlObj.hostname,
        'User-Agent': 'Mozilla/5.0 (compatible; ProxyValidator/1.0)',
        'Accept': '*/*',
        ...(proxy.auth ? { 'Proxy-Authorization': `Basic ${Buffer.from(proxy.auth).toString('base64')}` } : {}),
      },
    }

    const req = http.request(options, (res) => {
      res.resume()
      resolve(res.statusCode !== undefined && res.statusCode < 500)
    })

    req.on('error', () => resolve(false))
    req.on('timeout', () => { req.destroy(); resolve(false) })
    req.end()
  })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { proxies } = body as { proxies: string[] }

    if (!Array.isArray(proxies) || proxies.length === 0) {
      return NextResponse.json({ error: 'No proxies provided' }, { status: 400 })
    }

    const batch = proxies.slice(0, 50)

    const results = await Promise.all(
      batch.map(async (proxyStr) => {
        const parsed = parseProxy(proxyStr)
        if (!parsed) return { proxy: proxyStr, valid: false }
        const valid = await testProxy(parsed)
        return { proxy: proxyStr, valid }
      })
    )

    const valid = results.filter(r => r.valid).map(r => r.proxy)
    const invalid = results.filter(r => !r.valid).map(r => r.proxy)

    return NextResponse.json({ valid, invalid })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export const dynamic = 'force-dynamic'
