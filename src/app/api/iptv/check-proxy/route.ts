import { NextRequest, NextResponse } from 'next/server'
import http from 'node:http'

/**
 * POST — Check an IPTV line through a proxy server.
 * Body: { url: string, proxy: string }  — proxy is "ip:port" or "ip:port:user:pass"
 */

const STB_HEADERS: Record<string, string> = {
  'Cookie': 'stb_lang=en; timezone=Europe%2FIstanbul;',
  'X-User-Agent': 'Model: MAG254; Link: Ethernet',
  'Connection': 'Keep-Alive',
  'Accept-Encoding': 'gzip, deflate',
  'Accept': 'application/json,application/javascript,text/javascript,text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'User-Agent': 'Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 4 rev: 2721 Mobile Safari/533.3',
}

interface ProxyParts {
  host: string
  port: number
  auth?: string
}

function parseProxy(proxy: string): ProxyParts | null {
  const parts = proxy.trim().split(':')
  if (parts.length < 2) return null
  const host = parts[0]
  const port = parseInt(parts[1], 10)
  if (!host || isNaN(port) || port < 1 || port > 65535) return null
  const auth = parts.length >= 4 ? `${parts[2]}:${parts.slice(3).join(':')}` : undefined
  return { host, port, auth }
}

function fetchThroughProxy(targetUrl: string, proxy: ProxyParts): Promise<{ text: string; status: number }> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(targetUrl)

    const options: http.RequestOptions = {
      hostname: proxy.host,
      port: proxy.port,
      path: targetUrl,
      method: 'GET',
      timeout: 15000,
      headers: {
        'Host': urlObj.hostname,
        ...STB_HEADERS,
        ...(proxy.auth ? { 'Proxy-Authorization': `Basic ${Buffer.from(proxy.auth).toString('base64')}` } : {}),
      },
    }

    const req = http.request(options, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => resolve({ text: data, status: res.statusCode || 0 }))
    })

    req.on('error', (err) => reject(err))
    req.on('timeout', () => { req.destroy(); reject(new Error('Proxy request timeout')) })
    req.end()
  })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { url, proxy: proxyStr } = body as { url: string; proxy: string }

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    }
    if (!proxyStr || typeof proxyStr !== 'string') {
      return NextResponse.json({ error: 'Proxy is required' }, { status: 400 })
    }

    if (!url.includes('/player_api.php') && !url.includes('/get.php') && !url.includes('/panel_api.php')) {
      return NextResponse.json({ error: 'Invalid IPTV API URL' }, { status: 400 })
    }

    const proxy = parseProxy(proxyStr)
    if (!proxy) {
      return NextResponse.json({ error: 'Invalid proxy format' }, { status: 400 })
    }

    let response: { text: string; status: number }
    try {
      response = await fetchThroughProxy(url, proxy)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Connection failed'
      if (msg.includes('timeout')) {
        return NextResponse.json({ status: 'timeout', error: 'Proxy request timed out' })
      }
      return NextResponse.json({ status: 'bad', error: `Proxy error: ${msg}` })
    }

    const text = response.text

    try {
      const json = JSON.parse(text)
      return NextResponse.json({ rawText: text, json, status: 'ok' })
    } catch {
      return NextResponse.json({ rawText: text, status: 'ok' })
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export const dynamic = 'force-dynamic'
