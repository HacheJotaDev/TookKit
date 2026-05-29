import { NextRequest, NextResponse } from 'next/server'

/**
 * POST — Proxy a check request to an IPTV server.
 * NO DATABASE NEEDED — this is just a CORS proxy.
 * Body: { url: string, headers?: Record<string, string> }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { url, headers: customHeaders } = body as {
      url: string
      headers?: Record<string, string>
    }

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    }

    // Validate it looks like an IPTV API URL
    if (!url.includes('/player_api.php') && !url.includes('/get.php') && !url.includes('/panel_api.php')) {
      return NextResponse.json({ error: 'Invalid IPTV API URL' }, { status: 400 })
    }

    const STB_HEADERS: Record<string, string> = {
      'Cookie': 'stb_lang=en; timezone=Europe%2FIstanbul;',
      'X-User-Agent': 'Model: MAG254; Link: Ethernet',
      'Connection': 'Keep-Alive',
      'Accept-Encoding': 'gzip, deflate',
      'Accept': 'application/json,application/javascript,text/javascript,text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'User-Agent': 'Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 4 rev: 2721 Mobile Safari/533.3',
      ...(customHeaders || {}),
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000)

    let response: Response
    try {
      response = await fetch(url, {
        signal: controller.signal,
        headers: STB_HEADERS,
        redirect: 'follow',
      })
      clearTimeout(timeoutId)
    } catch (err: unknown) {
      clearTimeout(timeoutId)
      if (err instanceof DOMException && err.name === 'AbortError') {
        return NextResponse.json({ status: 'timeout', error: 'Request timed out' })
      }
      return NextResponse.json({ status: 'bad', error: 'Connection failed' })
    }

    const text = await response.text()

    // Try to parse as JSON
    try {
      const json = JSON.parse(text)
      return NextResponse.json({ rawText: text, json, status: 'ok' })
    } catch {
      // Return as text
      return NextResponse.json({ rawText: text, status: 'ok' })
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export const dynamic = 'force-dynamic'
