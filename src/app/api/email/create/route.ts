
import { NextRequest, NextResponse } from 'next/server'

// ─── Mail.tm API Configuration ─────────────────────────────
// Based on https://api.mail.tm documentation
// Flow: 1) GET /domains → 2) POST /accounts → 3) POST /token

const MAIL_PROVIDERS = [
  { name: 'mail.tm', baseUrl: 'https://api.mail.tm' },
  { name: 'mail.gw', baseUrl: 'https://api.mail.gw' },
]

const API_HEADERS: Record<string, string> = {
  'Accept': 'application/json',
  'Content-Type': 'application/json',
}

// ─── In-memory domain cache ─────────────────────────────────
// Fallback when fresh domain fetch fails (transient 5xx errors)

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
  // After 3 consecutive failures, skip for 3 minutes
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

// ─── Domain fetching with fallback ──────────────────────────

interface DomainResult {
  domain: string
  provider: { name: string; baseUrl: string }
}

async function fetchAvailableDomain(): Promise<DomainResult> {
  const allErrors: string[] = []

  // Prioritize healthy providers
  const healthyProviders = MAIL_PROVIDERS.filter(p => isProviderHealthy(p.name))
  const providersToTry = healthyProviders.length > 0 ? healthyProviders : MAIL_PROVIDERS

  for (const provider of providersToTry) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const domainsRes = await fetchWithTimeout(`${provider.baseUrl}/domains`, {
          headers: { Accept: 'application/json' },
        })

        if (domainsRes.ok) {
          const domainsData = await domainsRes.json()
          const domains = domainsData['hydra:member'] || domainsData

          if (Array.isArray(domains) && domains.length > 0) {
            const activeDomains = domains.filter((d: { isActive?: boolean }) => d.isActive !== false)
            if (activeDomains.length > 0) {
              const domain = activeDomains[0].domain
              // Cache the successful result
              domainCache = { domain, provider, cachedAt: Date.now() }
              markProviderSuccess(provider.name)
              return { domain, provider }
            }
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

      // Brief pause before retry on same provider
      if (attempt < 1) await new Promise(r => setTimeout(r, 1500))
    }
  }

  // ── Fallback: use cached domain if available ──────────────
  if (domainCache && Date.now() - domainCache.cachedAt < CACHE_TTL_MS) {
    return { domain: domainCache.domain, provider: domainCache.provider }
  }

  // ── Last resort: hardcode known domain if cache is empty ──
  // This handles the case where the app starts fresh and APIs are temporarily down
  if (!domainCache) {
    return { domain: 'wshu.net', provider: { name: 'mail.tm', baseUrl: 'https://api.mail.tm' } }
  }

  const errorDetail = allErrors.length > 0 ? allErrors.join(' | ') : 'proveedores no disponibles'
  throw new Error(`No se pudieron obtener los dominios (${errorDetail}). Intenta de nuevo en unos segundos.`)
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

    // Step 2: Generate random email address with valid username
    // mail.tm requires username to be alphanumeric, 1-64 chars
    const randomName = Array.from({ length: 8 }, () =>
      'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)]
    ).join('')
    const address = `${randomName}@${domain}`
    const password = Math.random().toString(36).substring(2, 14) + 'A1!'

    // Step 3: Create the account on mail.tm
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
      // If account creation fails on this provider, and we have a cached domain from a different provider, try that
      return NextResponse.json({
        error: `Error al crear cuenta (${createRes.status}). Intenta de nuevo.`,
        details: errorText,
      })
    }

    const accountData = await createRes.json()

    // Step 4: Get JWT token
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

    // Step 5: Try to save to database for session persistence
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
              accountId: accountData.id,
              provider: provider.name,
              expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
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
