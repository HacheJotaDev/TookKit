import { NextRequest, NextResponse } from 'next/server'

// Server-side in-memory cache (30min TTL)
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
  if (cache.size > 500) {
    const oldest = Array.from(cache.keys())[0]
    cache.delete(oldest)
  }
}

// ============================================================
// SCAMALYTICS PARSER
// ============================================================

function parseScamalytics(html: string): Record<string, unknown> | null {
  // Quick check — if no Fraud Score found, the page is a CF challenge/not the real page
  const scoreMatch = html.match(/Fraud Score:\s*(\d+)/)
  if (!scoreMatch) return null

  const score = parseInt(scoreMatch[1], 10)

  // Parse risk level from panel title text
  let risk = 'unknown'
  const titleMatch = html.match(/class="panel_title[^"]*"[^>]*>(.*?)<\/div>/)
  if (titleMatch) {
    const t = titleMatch[1].trim().toLowerCase()
    if (t.includes('high')) risk = 'high'
    else if (t.includes('medium')) risk = 'medium'
    else if (t.includes('low')) risk = 'low'
  }

  // Parse panel body
  const bodyMatch = html.match(/class="panel_body">([\s\S]*?)<\/div>/)
  const description = bodyMatch ? bodyMatch[1].replace(/<[^>]*>/g, '').trim() : ''

  // Parse table rows: <th>Label</th> ... <td>Value</td>
  function parseRow(label: string): string {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(
      `<th[^>]*>\\s*${escaped}\\s*</th>[\\s\\S]*?<td[^>]*>([\\s\\S]*?)</td>`,
      'i'
    )
    const match = html.match(regex)
    return match ? match[1].replace(/<[^>]*>/g, '').trim() : ''
  }

  // Parse risk div: <th>Label</th> ... <td><div class="risk ...">Value</div></td>
  function parseRiskRow(label: string): string {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(
      `<th[^>]*>\\s*${escaped}\\s*</th>[\\s\\S]*?<td[^>]*><div[^>]*class="[^"]*risk[^"]*"[^>]*>([\\s\\S]*?)</div>\\s*</td>`,
      'i'
    )
    const match = html.match(regex)
    return match ? match[1].replace(/<[^>]*>/g, '').trim() : ''
  }

  const operator = {
    hostname: parseRow('Hostname'),
    asn: parseRow('ASN'),
    ispName: parseRow('ISP Name'),
    orgName: parseRow('Organization Name'),
    connectionType: parseRow('Connection type'),
  }

  const location = {
    countryName: parseRow('Country Name'),
    countryCode: parseRow('Country Code'),
    state: parseRow('State / Province'),
    district: parseRow('District / County'),
    city: parseRow('City'),
    postalCode: parseRow('Postal Code'),
    latitude: parseRow('Latitude'),
    longitude: parseRow('Longitude'),
  }

  const datacenter = parseRiskRow('Datacenter')

  const proxies: Record<string, string> = {}
  for (const label of ['Anonymizing VPN', 'Tor Exit Node', 'Server', 'Public Proxy', 'Web Proxy', 'Search Engine Robot']) {
    proxies[label.replace(/\s+/g, '_').toLowerCase()] = parseRiskRow(label)
  }

  const blacklists: Record<string, string> = {}
  for (const label of ['Firehol', 'IP2ProxyLite', 'IPsum', 'Spamhaus', 'X4Bnet Spambot']) {
    blacklists[label.replace(/\s+/g, '_').toLowerCase()] = parseRiskRow(label)
  }

  const residentialProxy = parseRiskRow('Residential Proxy')

  return {
    score,
    risk,
    description,
    operator,
    location,
    datacenter,
    proxies,
    blacklists,
    residentialProxy,
    source: 'scamalytics',
  }
}

// ============================================================
// SCAMALYTICS FETCH (with Cloudflare bypass headers)
// ============================================================

async function fetchScamalytics(ip: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(`https://scamalytics.com/ip/${ip}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'max-age=0',
        'Sec-Ch-Ua': '"Chromium";v="136", "Google Chrome";v="136", "Not.A/Brand";v="99"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
        'Cookie': 'cookie_decision=accept',
        'Referer': 'https://scamalytics.com/',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(15000),
    })

    const html = await res.text()
    return parseScamalytics(html)
  } catch {
    return null
  }
}

// ============================================================
// FALLBACK: ip-api.com (free, no key, proxy/VPN detection)
// ============================================================

async function fetchIpApi(ip: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=status,message,country,countryCode,regionName,city,zip,lat,lon,isp,org,as,proxy,hosting,query`, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
      },
      signal: AbortSignal.timeout(8000),
    })

    if (!res.ok) return null

    const json = await res.json() as Record<string, unknown>
    if (json.status !== 'success') return null

    const isProxy = json.proxy === true
    const isHosting = json.hosting === true
    const fraudScore = (isProxy ? 75 : 0) + (isHosting ? 50 : 0)
    const score = Math.min(100, fraudScore)

    return {
      score,
      risk: score >= 50 ? 'high' : score >= 25 ? 'medium' : 'low',
      description: `IP ${ip} is ${json.isp || 'unknown ISP'}. ${isProxy ? 'Detected as proxy/VPN.' : ''}${isHosting ? 'Detected as hosting/datacenter.' : ''}`,
      operator: {
        ispName: (json.isp as string) || '',
        orgName: (json.org as string) || '',
        asn: ((json.as as string) || '').replace(/^AS\d+\s/, ''),
        hostname: '',
        connectionType: '',
      },
      location: {
        countryName: (json.country as string) || '',
        countryCode: (json.countryCode as string) || '',
        state: (json.regionName as string) || '',
        district: '',
        city: (json.city as string) || '',
        postalCode: (json.zip as string) || '',
        latitude: json.lat ? String(json.lat) : '',
        longitude: json.lon ? String(json.lon) : '',
      },
      datacenter: isHosting ? 'Yes' : 'No',
      proxies: {
        anonymizing_vpn: isProxy ? 'Yes' : 'No',
        tor_exit_node: 'No',
        server: isHosting ? 'Yes' : 'No',
        public_proxy: isProxy ? 'Yes' : 'No',
        web_proxy: 'No',
        search_engine_robot: 'No',
      },
      blacklists: {},
      residentialProxy: isProxy ? 'Yes' : 'No',
      source: 'ip-api',
    }
  } catch {
    return null
  }
}

// ============================================================
// MAIN ROUTE
// ============================================================

export async function GET(req: NextRequest) {
  try {
    const ip = req.nextUrl.searchParams.get('ip')
    if (!ip || !/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) {
      return NextResponse.json({ error: 'Invalid IP address' }, { status: 400 })
    }

    // Check cache
    const cached = getCached(ip)
    if (cached) {
      return NextResponse.json(cached, {
        headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600' },
      })
    }

    // Try scamalytics first, fall back to ip-api.com
    let result = await fetchScamalytics(ip)
    if (!result) {
      result = await fetchIpApi(ip)
    }

    if (!result) {
      return NextResponse.json({ error: 'No se pudo obtener datos de esta IP' }, { status: 502 })
    }

    const data = { ip, ...result }
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
