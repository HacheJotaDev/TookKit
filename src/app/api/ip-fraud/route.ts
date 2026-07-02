import { NextRequest, NextResponse } from 'next/server'

// Server-side in-memory cache (30min TTL — IP data changes infrequently)
const cache = new Map<string, { data: Record<string, unknown>; timestamp: number }>()
const CACHE_TTL = 30 * 60 * 1000

function getCached(ip: string): Record<string, unknown> | null {
  const entry = cache.get(ip)
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) return entry.data
  if (entry) cache.delete(ip)
  return null
}

function setCache(ip: string, data: Record<string, unknown>) {
  cache.set(ip, { data, timestamp: Date.now() })
  // Evict oldest entries if cache grows too large
  if (cache.size > 500) {
    const oldest = Array.from(cache.keys())[0]
    cache.delete(oldest)
  }
}

function parseTable(html: string, fields: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [key, label] of Object.entries(fields)) {
    // Match <th>Label</th> followed by <td>Value</td> patterns (including multiline)
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(
      `<th[^>]*>\\s*${escaped}\\s*</th>\\s*<td[^>]*>([\\s\\S]*?)</td>`,
      'i'
    )
    const match = html.match(regex)
    if (match) {
      // Strip HTML tags from the value
      result[key] = match[1].replace(/<[^>]*>/g, '').trim()
    }
  }
  return result
}

function parseRiskDiv(html: string, label: string): string {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(
    `<th[^>]*>\\s*${escaped}\\s*</th>\\s*<td[^>]*><div[^>]*class="[^"]*risk[^"]*"[^>]*>([\\s\\S]*?)</div>\\s*</td>`,
    'i'
  )
  const match = html.match(regex)
  if (match) return match[1].replace(/<[^>]*>/g, '').trim()
  return ''
}

export async function GET(req: NextRequest) {
  try {
    const ip = req.nextUrl.searchParams.get('ip')
    if (!ip || !/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) {
      return NextResponse.json({ error: 'Invalid IP address' }, { status: 400 })
    }

    // Check cache first
    const cached = getCached(ip)
    if (cached) {
      return NextResponse.json(cached, {
        headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600' },
      })
    }

    const res = await fetch(`https://scamalytics.com/ip/${ip}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      signal: AbortSignal.timeout(12000),
    })

    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to fetch IP data' }, { status: 502 })
    }

    const html = await res.text()

    // Parse fraud score
    const scoreMatch = html.match(/Fraud Score:\s*(\d+)/)
    const score = scoreMatch ? parseInt(scoreMatch[1], 10) : -1

    // Parse risk level from panel title
    let risk = 'unknown'
    const titleMatch = html.match(/class="panel_title[^"]*"[^>]*>(.*?)<\/div>/)
    if (titleMatch) {
      const titleText = titleMatch[1].trim().toLowerCase()
      if (titleText.includes('high')) risk = 'high'
      else if (titleText.includes('medium')) risk = 'medium'
      else if (titleText.includes('low')) risk = 'low'
    }

    // Parse panel body description
    const bodyMatch = html.match(/class="panel_body">([\s\S]*?)<\/div>/)
    const description = bodyMatch ? bodyMatch[1].replace(/<[^>]*>/g, '').trim() : ''

    // Parse operator info
    const operatorFields = parseTable(html, {
      hostname: 'Hostname',
      asn: 'ASN',
      ispName: 'ISP Name',
      orgName: 'Organization Name',
      connectionType: 'Connection type',
    })

    // Parse location info
    const locationFields = parseTable(html, {
      countryName: 'Country Name',
      countryCode: 'Country Code',
      state: 'State / Province',
      district: 'District / County',
      city: 'City',
      postalCode: 'Postal Code',
      latitude: 'Latitude',
      longitude: 'Longitude',
    })

    // Parse datacenter status
    const datacenterStatus = parseRiskDiv(html, 'Datacenter')

    // Parse proxy checks
    const proxyFields: Record<string, string> = {}
    const proxyLabels = [
      'Anonymizing VPN',
      'Tor Exit Node',
      'Server',
      'Public Proxy',
      'Web Proxy',
      'Search Engine Robot',
    ]
    for (const label of proxyLabels) {
      const shortKey = label.replace(/\s+/g, '_').toLowerCase()
      proxyFields[shortKey] = parseRiskDiv(html, label)
    }

    // Parse blacklist checks
    const blacklistLabels = ['Firehol', 'IP2ProxyLite', 'IPsum', 'Spamhaus', 'X4Bnet Spambot']
    const blacklistFields: Record<string, string> = {}
    for (const label of blacklistLabels) {
      const shortKey = label.replace(/\s+/g, '_').toLowerCase()
      blacklistFields[shortKey] = parseRiskDiv(html, label)
    }

    // Parse residential proxy
    const residentialProxy = parseRiskDiv(html, 'Residential Proxy')

    const data = {
      ip,
      score,
      risk,
      description,
      operator: operatorFields,
      location: locationFields,
      datacenter: datacenterStatus,
      proxies: proxyFields,
      blacklists: blacklistFields,
      residentialProxy,
    }

    setCache(ip, data)

    return NextResponse.json(data, {
      status: 200,
      headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600' },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: `IP lookup failed: ${msg}` }, { status: 500 })
  }
}
