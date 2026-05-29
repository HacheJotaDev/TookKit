
import { NextRequest, NextResponse } from 'next/server'

// ─── Mail.tm API ───────────────────────────────────────────
// API docs: https://docs.mail.tm
// Flow: GET /domains → POST /accounts → POST /token
// IMPORTANT: Must use Accept: application/ld+json for proper Hydra response format

const MAIL_PROVIDERS = [
  { name: 'mail.tm', baseUrl: 'https://api.mail.tm' },
  { name: 'mail.gw', baseUrl: 'https://api.mail.gw' },
]

const API_HEADERS: Record<string, string> = {
  'Accept': 'application/ld+json',
  'Content-Type': 'application/json',
}

// ─── In-memory domain cache ─────────────────────────────────

interface CachedDomain {
  domain: string
  provider: { name: string; baseUrl: string }
  cachedAt: number
}

let domainCache: CachedDomain | null = null
const CACHE_TTL_MS = 30 * 60 * 1000 // 30 minutes

// ─── Provider health tracking ──────────────────────────────

interface ProviderHealth {
  consecutiveFailures: number
  lastFailAt: number
}

const providerHealth: Record<string, ProviderHealth> = {}

function isProviderHealthy(providerName: string): boolean {
  const health = providerHealth[providerName]
  if (!health || health.consecutiveFailures === 0) return true
  if (health.consecutiveFailures >= 3 && Date.now() - health.lastFailAt < 3 * 60 * 1000) {
    return false
  }
  return true
}

function markProviderSuccess(providerName: string) {
  providerHealth[providerName] = { consecutiveFailures: 0, lastFailAt: 0 }
}

function markProviderFailure(providerName: string) {
  const health = providerHealth[providerName] || { consecutiveFailures: 0, lastFailAt: 0 }
  health.consecutiveFailures++
  health.lastFailAt = Date.now()
  providerHealth[providerName] = health
}

// ─── Fetch with timeout ─────────────────────────────────────

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

// ─── Extract domains from API response ─────────────────────
// The mail.tm API returns different formats depending on Accept header:
// - application/ld+json → { hydra:member: [...] } (PREFERRED)
// - application/json    → [ ... ] (array, less reliable)

function extractDomainsFromResponse(data: unknown): { domain: string; isActive: boolean }[] {
  if (Array.isArray(data)) {
    return data.map((d: Record<string, unknown>) => ({
      domain: String(d.domain || ''),
      isActive: d.isActive !== false,
    }))
  }
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>
    const members = obj['hydra:member']
    if (Array.isArray(members)) {
      return members.map((d: Record<string, unknown>) => ({
        domain: String(d.domain || ''),
        isActive: d.isActive !== false,
      }))
    }
  }
  return []
}

// ─── Domain fetching with fallbacks ─────────────────────────

interface DomainResult {
  domain: string
  provider: { name: string; baseUrl: string }
}

async function fetchAvailableDomain(): Promise<DomainResult> {
  const allErrors: string[] = []
  const healthyProviders = MAIL_PROVIDERS.filter(p => isProviderHealthy(p.name))
  const providersToTry = healthyProviders.length > 0 ? healthyProviders : MAIL_PROVIDERS

  for (const provider of providersToTry) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const domainsRes = await fetchWithTimeout(`${provider.baseUrl}/domains`, {
          headers: { Accept: 'application/ld+json' },
        })

        if (domainsRes.ok) {
          const domainsData = await domainsRes.json()
          const domains = extractDomainsFromResponse(domainsData)

          const activeDomains = domains.filter(d => d.isActive && d.domain)
          if (activeDomains.length > 0) {
            const domain = activeDomains[0].domain
            domainCache = { domain, provider, cachedAt: Date.now() }
            markProviderSuccess(provider.name)
            return { domain, provider }
          }
          allErrors.push(`${provider.name}: No hay dominios activos`)
          markProviderFailure(provider.name)
        } else {
          allErrors.push(`${provider.name}: HTTP ${domainsRes.status}`)
          markProviderFailure(provider.name)
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Network error'
        allErrors.push(`${provider.name}: ${msg}`)
        markProviderFailure(provider.name)
      }

      if (attempt < 1) await new Promise(r => setTimeout(r, 1500))
    }
  }

  // Fallback 1: use cached domain
  if (domainCache && Date.now() - domainCache.cachedAt < CACHE_TTL_MS) {
    return { domain: domainCache.domain, provider: domainCache.provider }
  }

  // Fallback 2: hardcoded known domain (last resort)
  return { domain: 'wshu.net', provider: { name: 'mail.tm', baseUrl: 'https://api.mail.tm' } }
}

// ─── POST: Create email account ─────────────────────────────

export async function POST(req: NextRequest) {
  try {
    // Step 1: Get available domain
    let domainResult: DomainResult
    try {
      domainResult = await fetchAvailableDomain()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      return NextResponse.json({ error: msg })
    }

    const { domain, provider } = domainResult
    const baseUrl = provider.baseUrl

    // Step 2: Generate random email address
    // mail.tm requires: alphanumeric username, 1-64 chars, valid domain
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
    let randomName = ''
    for (let i = 0; i < 10; i++) {
      randomName += chars[Math.floor(Math.random() * chars.length)]
    }
    const address = `${randomName}@${domain}`
    const password = 'Tp' + Array.from({ length: 12 }, () =>
      'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[Math.floor(Math.random() * 62)]
    ).join('') + '!1'

    // Step 3: Create the account via POST /accounts
    let createRes: Response | null = null
    try {
      createRes = await fetchWithTimeout(`${baseUrl}/accounts`, {
        method: 'POST',
        headers: API_HEADERS,
        body: JSON.stringify({ address, password }),
      })
    } catch {
      return NextResponse.json({ error: 'Error de conexión al crear la cuenta. Intenta de nuevo.' })
    }

    if (!createRes.ok) {
      const errorText = await createRes.text()
      return NextResponse.json({
        error: `Error al crear cuenta (${createRes.status}). Intenta de nuevo.`,
        details: errorText,
      })
    }

    const accountData = await createRes.json()
    const accountId = accountData.id || accountData['@id']?.split('/')?.pop()

    // Step 4: Get JWT token via POST /token
    let tokenRes: Response | null = null
    try {
      tokenRes = await fetchWithTimeout(`${baseUrl}/token`, {
        method: 'POST',
        headers: API_HEADERS,
        body: JSON.stringify({ address, password }),
      })
    } catch {
      return NextResponse.json({ error: 'Error de conexión al obtener el token. Intenta de nuevo.' })
    }

    if (!tokenRes.ok) {
      return NextResponse.json({ error: 'Error al obtener el token de acceso' })
    }

    const tokenData = await tokenRes.json()
    const token = tokenData.token || tokenData['hydra:member']?.token

    if (!token) {
      return NextResponse.json({ error: 'No se pudo obtener el token de acceso' })
    }

    // Step 5: Save to database for session persistence
    const sessionId = req.headers.get('x-session-id')
    if (sessionId) {
      try {
        const { prisma, hasDatabaseUrl } = await import('@/lib/prisma')
        if (hasDatabaseUrl) {
          const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          await prisma.session.upsert({
            where: { id: sessionId },
            update: { lastSeen: new Date(), expiresAt },
            create: { id: sessionId, expiresAt },
          })

          await prisma.tempEmail.create({
            data: {
              sessionId,
              address,
              token,
              accountId: accountId || '',
              provider: provider.name,
              expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
            },
          })
        }
      } catch {
        // DB save is non-critical
      }
    }

    return NextResponse.json({
      address,
      token,
      id: accountId,
      provider: provider.name,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: `Error inesperado: ${message}` }, { status: 500 })
  }
}
