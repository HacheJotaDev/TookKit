
import { NextRequest, NextResponse } from 'next/server'

// Both providers share the same API format but are separate backends
const MAIL_PROVIDERS = [
  { name: 'mail.tm', baseUrl: 'https://api.mail.tm' },
  { name: 'mail.gw', baseUrl: 'https://api.mail.gw' },
]

const MAIL_TM_HEADERS: Record<string, string> = {
  'Accept': 'application/ld+json',
  'Content-Type': 'application/json',
}

// ── In-memory domain cache ──────────────────────────────────
// If the fresh domain fetch fails (e.g. transient 502),
// we fall back to the last known-good domain+provider.
interface CachedDomain {
  domain: string
  provider: { name: string; baseUrl: string }
  cachedAt: number
}

let domainCache: CachedDomain | null = null
const CACHE_TTL_MS = 30 * 60 * 1000 // 30 minutes

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

interface DomainResult {
  domain: string
  provider: { name: string; baseUrl: string }
}

// ── Track recent provider failures to skip unhealthy ones ───
interface ProviderHealth {
  consecutiveFailures: number
  lastFailAt: number
}

const providerHealth: Record<string, ProviderHealth> = {}

function isProviderHealthy(providerName: string): boolean {
  const health = providerHealth[providerName]
  if (!health || health.consecutiveFailures === 0) return true
  // If it failed more than 5 times in a row, skip it for 5 minutes
  if (health.consecutiveFailures >= 5 && Date.now() - health.lastFailAt < 5 * 60 * 1000) {
    return false
  }
  // After 5 minutes cool-down, give it another try
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

async function fetchAvailableDomain(): Promise<DomainResult> {
  const allErrors: string[] = []
  const healthyProviders = MAIL_PROVIDERS.filter(p => isProviderHealthy(p.name))

  // If no providers are healthy, try them all anyway (last resort)
  const providersToTry = healthyProviders.length > 0 ? healthyProviders : MAIL_PROVIDERS

  for (const provider of providersToTry) {
    // Up to 3 attempts per provider with exponential back-off
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const domainsRes = await fetchWithTimeout(`${provider.baseUrl}/domains`, {
          headers: { Accept: 'application/ld+json' },
        })

        if (domainsRes.ok) {
          const domainsData = await domainsRes.json()
          const domains = domainsData['hydra:member'] || domainsData

          if (Array.isArray(domains) && domains.length > 0) {
            const activeDomains = domains.filter((d: { isActive?: boolean }) => d.isActive !== false)
            if (activeDomains.length > 0) {
              const domain = activeDomains[Math.floor(Math.random() * activeDomains.length)].domain
              // Cache the successful result
              domainCache = { domain, provider, cachedAt: Date.now() }
              markProviderSuccess(provider.name)
              return { domain, provider }
            }
          }
          const errMsg = `${provider.name}: No hay dominios activos`
          allErrors.push(errMsg)
          markProviderFailure(provider.name)
        } else {
          const errMsg = `${provider.name}: HTTP ${domainsRes.status}`
          allErrors.push(errMsg)
          markProviderFailure(provider.name)
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Network error'
        const errMsg = `${provider.name}: ${msg}`
        allErrors.push(errMsg)
        markProviderFailure(provider.name)
      }

      // Exponential back-off: 1s, 2s between attempts
      if (attempt < 2) await new Promise(r => setTimeout(r, 1000 * (attempt + 1)))
    }
  }

  // ── Fallback to cached domain if available ────────────────
  if (domainCache && Date.now() - domainCache.cachedAt < CACHE_TTL_MS) {
    return { domain: domainCache.domain, provider: domainCache.provider }
  }

  // Build a comprehensive error message showing all failures
  const errorDetail = allErrors.length > 0 ? allErrors.join(' | ') : 'proveedores no disponibles'
  throw new Error(`No se pudieron obtener los dominios (${errorDetail}). Intenta de nuevo en unos segundos.`)
}

export async function POST(req: NextRequest) {
  try {
    // Step 1: Get available domains (tries all providers, falls back to cache)
    let domainResult: DomainResult
    try {
      domainResult = await fetchAvailableDomain()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      return NextResponse.json({ error: msg })
    }

    const { domain, provider } = domainResult
    const baseUrl = provider.baseUrl

    // Step 2: Generate random email and create account
    const randomName = Math.random().toString(36).substring(2, 10)
    const address = `${randomName}@${domain}`
    const password = Math.random().toString(36).substring(2, 14) + 'A1!'

    let createRes: Response | null = null
    try {
      createRes = await fetchWithTimeout(`${baseUrl}/accounts`, {
        method: 'POST',
        headers: MAIL_TM_HEADERS,
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

    // Step 3: Get JWT token
    let tokenRes: Response | null = null
    try {
      tokenRes = await fetchWithTimeout(`${baseUrl}/token`, {
        method: 'POST',
        headers: MAIL_TM_HEADERS,
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

    // Step 4: Try to save to database for session persistence
    const sessionId = req.headers.get('x-session-id')
    if (sessionId) {
      try {
        const { prisma, hasDatabaseUrl } = await import('@/lib/prisma')
        if (hasDatabaseUrl) {
          // Ensure session exists
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
              accountId: accountData.id,
              provider: provider.name,
              expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h
            },
          })
        }
      } catch {
        // DB save is non-critical — the email still works
      }
    }

    return NextResponse.json({
      address,
      token,
      id: accountData.id,
      provider: provider.name,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: `Error inesperado: ${message}` }, { status: 500 })
  }
}
