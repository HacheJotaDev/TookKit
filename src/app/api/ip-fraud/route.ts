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
// SOURCE 1: ipgeolocation.io — Geolocation
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
// SOURCE 2: ipgeolocation.io — IP Security API
// ============================================================

interface SecurityResponse {
  ip: string
  security: {
    threat_score: number
    is_tor: boolean
    is_proxy: boolean
    proxy_provider_names: string[]
    proxy_confidence_score: number
    proxy_last_seen: string
    is_residential_proxy: boolean
    is_vpn: boolean
    vpn_provider_names: string[]
    vpn_confidence_score: number
    vpn_last_seen: string
    is_relay: boolean
    relay_provider_name: string
    is_anonymous: boolean
    is_known_attacker: boolean
    is_bot: boolean
    is_spam: boolean
    is_cloud_provider: boolean
    cloud_provider_name: string
  }
}

async function fetchIpSecurity(ip: string): Promise<SecurityResponse | null> {
  try {
    const res = await fetch(
      `https://api.ipgeolocation.io/v3/security?apiKey=${IPGEO_API_KEY}&ip=${ip}`,
      { signal: AbortSignal.timeout(8000) }
    )
    if (!res.ok) return null
    const json = await res.json() as SecurityResponse
    if (!json.security) return null
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

    // Fetch both ipgeolocation APIs in parallel
    const [geo, sec] = await Promise.all([fetchIpGeo(ip), fetchIpSecurity(ip)])

    if (!geo && !sec) {
      return NextResponse.json({ error: 'No se pudo obtener datos de esta IP' }, { status: 502 })
    }

    // Security data from ipgeolocation Security API
    const s = sec?.security
    const threatScore = s?.threat_score ?? 0
    const risk = threatScore >= 50 ? 'high' : threatScore >= 25 ? 'medium' : 'low'

    // Location from geolocation API
    const location = {
      countryName: (geo?.country_name as string) || '',
      countryCode: (geo?.country_code2 as string) || '',
      state: (geo?.state_prov as string) || '',
      district: (geo?.district as string) || '',
      city: (geo?.city as string) || '',
      postalCode: (geo?.zipcode as string) || '',
    }

    // Operator from geolocation API
    const operator = {
      ispName: (geo?.isp as string) || '',
      orgName: (geo?.organization as string) || '',
      connectionType: (geo?.connection_type as string) || '',
    }

    // Security checks from Security API
    const proxies: Record<string, string> = {
      anonymizing_vpn: s?.is_vpn ? 'Yes' : 'No',
      tor_exit_node: s?.is_tor ? 'Yes' : 'No',
      server: s?.is_cloud_provider ? 'Yes' : 'No',
      public_proxy: s?.is_proxy ? 'Yes' : 'No',
      web_proxy: s?.is_relay ? 'Yes' : 'No',
      search_engine_robot: s?.is_bot ? 'Yes' : 'No',
    }

    const data = {
      ip,
      score: threatScore,
      risk,
      operator,
      location,
      datacenter: s?.is_cloud_provider ? 'Yes' : 'No',
      proxies,
      residentialProxy: s?.is_residential_proxy ? 'Yes' : 'No',
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
