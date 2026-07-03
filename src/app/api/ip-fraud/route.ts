import { NextRequest, NextResponse } from 'next/server'

// Server-side in-memory cache (30min TTL)
const cache = new Map<string, { data: Record<string, unknown>; timestamp: number }>()
const CACHE_TTL = 30 * 60 * 1000

const SCAMALYTICS_USER = '6a4726284d0d8'
const SCAMALYTICS_KEY = 'caf46c54b92a99f5e1da8daaf2e9a5f3c7a665c0f35184474ee698140b9263de'

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
// Scamalytics API v3 — Single source for all fraud data
// ============================================================

interface ScamalyticsProxy {
  is_datacenter: boolean
  is_vpn: boolean
  is_apple_icloud_private_relay: boolean
  is_amazon_aws: boolean
  is_google: boolean
}

interface ScamalyticsCore {
  status: string
  mode: string
  ip: string
  scamalytics_score: number
  scamalytics_risk: string
  scamalytics_url: string
  scamalytics_isp: string
  scamalytics_org: string
  scamalytics_isp_score: number
  scamalytics_isp_risk: string
  scamalytics_proxy: ScamalyticsProxy
  is_blacklisted_external: boolean
}

interface DbIpData {
  ip_country_code: string
  ip_state_name: string
  ip_district_name: string
  ip_city: string
  ip_postcode: string
  ip_geolocation: string
  ip_country_name: string
  isp_name: string
  org_name: string
  connection_type: string | null
}

interface X4bNetData {
  is_vpn: boolean
  is_datacenter: boolean
  is_tor: boolean
  is_blacklisted_spambot: boolean
  is_bot_operamini: boolean
  is_bot_semrush: boolean
}

interface FireholData {
  ip_blacklisted_30: boolean
  ip_blacklisted_1day: boolean
  is_proxy: boolean
}

interface GoogleData {
  is_google_general: boolean
  is_googlebot: boolean
  is_special_crawler: boolean
  is_user_triggered_fetcher: boolean
  is_google_cloud: boolean
}

interface ScamalyticsResponse {
  scamalytics: ScamalyticsCore
  external_datasources: {
    dbip: DbIpData
    x4bnet: X4bNetData
    firehol: FireholData
    google: GoogleData
    spamhaus_drop: { ip_blacklisted: boolean }
    ipsum: { ip_blacklisted: boolean; num_blacklists: number }
    [key: string]: unknown
  }
}

async function fetchScamalytics(ip: string): Promise<ScamalyticsResponse | null> {
  try {
    const res = await fetch(
      `https://api11.scamalytics.com/v3/${SCAMALYTICS_USER}/?key=${SCAMALYTICS_KEY}&ip=${ip}`,
      {
        signal: AbortSignal.timeout(10000),
        headers: {
          'Accept': 'application/json',
        },
      }
    )
    if (!res.ok) return null
    const json = await res.json() as ScamalyticsResponse
    if (!json.scamalytics || json.scamalytics.status !== 'ok') return null
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

    // Fetch Scamalytics (single source for all data)
    const scam = await fetchScamalytics(ip)

    if (!scam) {
      return NextResponse.json({ error: 'No se pudo obtener datos de esta IP' }, { status: 502 })
    }

    const core = scam.scamalytics
    const ext = scam.external_datasources

    // Score and Risk
    const score = core.scamalytics_score
    const risk = core.scamalytics_risk === 'high' ? 'high'
      : core.scamalytics_risk === 'medium' ? 'medium' : 'low'

    // Operator — prefer scamalytics core ISP/Org
    const operator = {
      ispName: core.scamalytics_isp || ext.dbip?.isp_name || '',
      orgName: core.scamalytics_org || ext.dbip?.org_name || '',
      connectionType: ext.dbip?.connection_type || '',
    }

    // Location from dbip (most detailed geolocation in Scamalytics response)
    const location = {
      countryName: ext.dbip?.ip_country_name || '',
      countryCode: ext.dbip?.ip_country_code || '',
      state: ext.dbip?.ip_state_name || '',
      district: ext.dbip?.ip_district_name || '',
      city: ext.dbip?.ip_city || '',
      postalCode: ext.dbip?.ip_postcode || '',
    }

    // Proxy & VPN checks — aggregated from multiple external sources
    const isVpn = core.scamalytics_proxy?.is_vpn || ext.x4bnet?.is_vpn || false
    const isTor = ext.x4bnet?.is_tor || false
    const isDatacenter = core.scamalytics_proxy?.is_datacenter || ext.x4bnet?.is_datacenter || false
    const isPublicProxy = ext.firehol?.is_proxy || false
    const isBot = ext.google?.is_googlebot || ext.x4bnet?.is_bot_semrush || false
    const isBlacklisted = core.is_blacklisted_external
      || ext.firehol?.ip_blacklisted_30
      || ext.spamhaus_drop?.ip_blacklisted
      || ext.ipsum?.ip_blacklisted
      || false

    const proxies: Record<string, string> = {
      anonymizing_vpn: isVpn ? 'Yes' : 'No',
      tor_exit_node: isTor ? 'Yes' : 'No',
      server: isDatacenter ? 'Yes' : 'No',
      public_proxy: isPublicProxy ? 'Yes' : 'No',
      search_engine_robot: isBot ? 'Yes' : 'No',
      blacklisted: isBlacklisted ? 'Yes' : 'No',
    }

    const data = {
      ip,
      score,
      risk,
      operator,
      location,
      proxies,
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
