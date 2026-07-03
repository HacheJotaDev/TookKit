import { NextRequest, NextResponse } from 'next/server'

// Server-side in-memory cache (30min TTL)
const cache = new Map<string, { data: Record<string, unknown>; timestamp: number }>()
const CACHE_TTL = 30 * 60 * 1000

const IPGEO_API_KEY = '607609183b2b45ad833096cb7bc40438'

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
// SOURCE 1: ipgeolocation.io — Geolocation (rich data, API key)
// ============================================================

async function fetchIpGeo(ip: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(
      `https://api.ipgeolocation.io/ipgeo?apiKey=${IPGEO_API_KEY}&ip=${ip}`,
      { signal: AbortSignal.timeout(8000) }
    )
    if (!res.ok) return null
    const json = await res.json() as Record<string, unknown>
    if (!json.ip) return null
    return json
  } catch {
    return null
  }
}

// ============================================================
// SOURCE 2: ip-api.com — Security (proxy/VPN/hosting detection)
// ============================================================

async function fetchIpSecurity(ip: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(
      `http://ip-api.com/json/${ip}?fields=status,message,proxy,hosting,query`,
      { signal: AbortSignal.timeout(8000) }
    )
    if (!res.ok) return null
    const json = await res.json() as Record<string, unknown>
    if (json.status !== 'success') return null
    return json
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

    // Fetch both sources in parallel
    const [geo, security] = await Promise.all([fetchIpGeo(ip), fetchIpSecurity(ip)])

    if (!geo && !security) {
      return NextResponse.json({ error: 'No se pudo obtener datos de esta IP' }, { status: 502 })
    }

    // Compute threat score from security data
    const isProxy = (security?.proxy as boolean) || false
    const isHosting = (security?.hosting as boolean) || false
    const threatScore = Math.min(100, (isProxy ? 75 : 0) + (isHosting ? 50 : 0))

    const risk = threatScore >= 50 ? 'high' : threatScore >= 25 ? 'medium' : 'low'

    // Build location from geo data
    const location = {
      countryName: (geo?.country_name as string) || '',
      countryCode: (geo?.country_code2 as string) || '',
      countryFlag: (geo?.country_flag as string) || '',
      countryEmoji: (geo?.country_emoji as string) || '',
      state: (geo?.state_prov as string) || '',
      district: (geo?.district as string) || '',
      city: (geo?.city as string) || '',
      postalCode: (geo?.zipcode as string) || '',
      latitude: (geo?.latitude as string) || '',
      longitude: (geo?.longitude as string) || '',
      timezone: ((geo?.time_zone as Record<string, unknown>)?.name as string) || '',
      currency: ((geo?.currency as Record<string, unknown>)?.code as string) || '',
      languages: (geo?.languages as string) || '',
    }

    // Build operator from geo data
    const operator = {
      ispName: (geo?.isp as string) || '',
      orgName: (geo?.organization as string) || '',
      connectionType: (geo?.connection_type as string) || '',
    }

    // Build security checks
    const proxies: Record<string, string> = {
      anonymizing_vpn: isProxy ? 'Yes' : 'No',
      tor_exit_node: 'No',
      server: isHosting ? 'Yes' : 'No',
      public_proxy: isProxy ? 'Yes' : 'No',
      web_proxy: 'No',
      search_engine_robot: 'No',
    }

    const data = {
      ip,
      score: threatScore,
      risk,
      operator,
      location,
      datacenter: isHosting ? 'Yes' : 'No',
      proxies,
      residentialProxy: isProxy ? 'Yes' : 'No',
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
