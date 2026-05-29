
import { NextRequest, NextResponse } from 'next/server'

// ─── Mail.tm / Mail.gw API ────────────────────────────────
// Flow: GET /domains → POST /accounts → POST /token
// Use Accept: application/ld+json (Hydra format with hydra:member)

const MAIL_PROVIDERS = [
  { name: 'mail.tm', baseUrl: 'https://api.mail.tm' },
  { name: 'mail.gw', baseUrl: 'https://api.mail.gw' },
]

const API_HEADERS: Record<string, string> = {
  'Accept': 'application/ld+json',
  'Content-Type': 'application/json',
}

// ─── Domain cache ──────────────────────────────────────────

interface CachedDomain {
  domain: string
  provider: { name: string; baseUrl: string }
  cachedAt: number
}

let domainCache: CachedDomain | null = null
const CACHE_TTL_MS = 30 * 60 * 1000

// ─── Provider health ──────────────────────────────────────

interface ProviderHealth {
  consecutiveFailures: number
  lastFailAt: number
}

const providerHealth: Record<string, ProviderHealth> = {}

function isProviderHealthy(name: string): boolean {
  const h = providerHealth[name]
  if (!h || h.consecutiveFailures === 0) return true
  if (h.consecutiveFailures >= 3 && Date.now() - h.lastFailAt < 5 * 60 * 1000) return false
  return true
}

function markSuccess(name: string) {
  providerHealth[name] = { consecutiveFailures: 0, lastFailAt: 0 }
}

function markFailure(name: string) {
  const h = providerHealth[name] || { consecutiveFailures: 0, lastFailAt: 0 }
  h.consecutiveFailures++
  h.lastFailAt = Date.now()
  providerHealth[name] = h
}

// ─── Fetch with timeout ────────────────────────────────────

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 15000): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timeoutId)
  }
}

// ─── Extract domains from either response format ──────────

function extractDomains(data: unknown): { domain: string; isActive: boolean }[] {
  if (Array.isArray(data)) {
    return data.map((d: Record<string, unknown>) => ({
      domain: String(d.domain || ''),
      isActive: d.isActive !== false,
    }))
  }
  if (data && typeof data === 'object') {
    const members = (data as Record<string, unknown>)['hydra:member']
    if (Array.isArray(members)) {
      return members.map((d: Record<string, unknown>) => ({
        domain: String(d.domain || ''),
        isActive: d.isActive !== false,
      }))
    }
  }
  return []
}

// ─── Domain fetching ──────────────────────────────────────

interface DomainResult {
  domain: string
  provider: { name: string; baseUrl: string }
}

async function fetchAvailableDomain(): Promise<DomainResult> {
  const healthy = MAIL_PROVIDERS.filter(p => isProviderHealthy(p.name))
  const toTry = healthy.length > 0 ? healthy : MAIL_PROVIDERS

  for (const provider of toTry) {
    try {
      const res = await fetchWithTimeout(`${provider.baseUrl}/domains`, {
        headers: { Accept: 'application/ld+json' },
      })

      if (res.ok) {
        const data = await res.json()
        const domains = extractDomains(data)
        const active = domains.filter(d => d.isActive && d.domain)
        if (active.length > 0) {
          const domain = active[0].domain
          domainCache = { domain, provider, cachedAt: Date.now() }
          markSuccess(provider.name)
          return { domain, provider }
        }
      }
      markFailure(provider.name)
    } catch {
      markFailure(provider.name)
    }
  }

  // Fallback: cached domain
  if (domainCache && Date.now() - domainCache.cachedAt < CACHE_TTL_MS) {
    return { domain: domainCache.domain, provider: domainCache.provider }
  }

  // Fallback: hardcoded known domain
  return { domain: 'wshu.net', provider: { name: 'mail.tm', baseUrl: 'https://api.mail.tm' } }
}

// ─── Create account with retry + provider fallback ────────

interface AccountResult {
  address: string
  token: string
  id: string
  provider: string
}

async function createAccountOnProvider(
  baseUrl: string,
  providerName: string,
): Promise<AccountResult> {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let username = ''
  for (let i = 0; i < 10; i++) {
    username += chars[Math.floor(Math.random() * chars.length)]
  }

  // Get fresh domain for this provider
  const domainRes = await fetchWithTimeout(`${baseUrl}/domains`, {
    headers: { Accept: 'application/ld+json' },
  })

  let domain = ''
  if (domainRes.ok) {
    const data = await domainRes.json()
    const domains = extractDomains(data)
    const active = domains.filter(d => d.isActive && d.domain)
    if (active.length > 0) domain = active[0].domain
  }

  // Fallback to cached or hardcoded
  if (!domain && domainCache) domain = domainCache.domain
  if (!domain) domain = 'wshu.net'

  const address = `${username}@${domain}`
  const password = 'Tp' + Array.from({ length: 12 }, () =>
    'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[Math.floor(Math.random() * 62)]
  ).join('') + '!1'

  // POST /accounts with retry on rate-limit or server error
  let accountData: Record<string, unknown> | null = null
  for (let attempt = 0; attempt < 3; attempt++) {
    const createRes = await fetchWithTimeout(`${baseUrl}/accounts`, {
      method: 'POST',
      headers: API_HEADERS,
      body: JSON.stringify({ address, password }),
    })

    if (createRes.ok) {
      accountData = await createRes.json()
      break
    }

    const status = createRes.status
    // 422 = validation error (bad address format) — don't retry, it won't change
    if (status === 422) {
      const errText = await createRes.text()
      throw new Error(`Dirección inválida (${status}): ${errText}`)
    }

    // 429 = rate limited, 500/502/503 = server error — retry with backoff
    if (status === 429 || status >= 500) {
      if (attempt < 2) {
        await new Promise(r => setTimeout(r, 2000 * (attempt + 1)))
        continue
      }
      const errText = await createRes.text()
      throw new Error(`Servidor ${providerName} no disponible (${status}). Intenta de nuevo en unos segundos.`)
    }

    // Other errors
    const errText = await createRes.text()
    throw new Error(`Error al crear cuenta en ${providerName} (${status}): ${errText}`)
  }

  if (!accountData) {
    throw new Error('No se pudo crear la cuenta después de varios intentos.')
  }

  const accountId = String(accountData.id || (accountData['@id'] as string)?.split('/')?.pop() || '')

  // POST /token with retry
  let token = ''
  for (let attempt = 0; attempt < 3; attempt++) {
    const tokenRes = await fetchWithTimeout(`${baseUrl}/token`, {
      method: 'POST',
      headers: API_HEADERS,
      body: JSON.stringify({ address, password }),
    })

    if (tokenRes.ok) {
      const tokenData = await tokenRes.json()
      token = tokenData.token || tokenData['hydra:member']?.token || ''
      if (token) break
    }

    if (attempt < 2) {
      await new Promise(r => setTimeout(r, 1500 * (attempt + 1)))
    }
  }

  if (!token) {
    throw new Error('No se pudo obtener el token de acceso. Intenta de nuevo.')
  }

  return { address, token, id: accountId, provider: providerName }
}

// ─── POST handler ─────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    // Step 1: Find a working provider+domain
    const { domain, provider } = await fetchAvailableDomain()

    // Step 2: Try creating account on the primary provider
    // If it fails, try ALL other providers as fallback
    const providersToTry = [provider, ...MAIL_PROVIDERS.filter(p => p.name !== provider.name)]
    const errors: string[] = []

    for (const prov of providersToTry) {
      try {
        const result = await createAccountOnProvider(prov.baseUrl, prov.name)
        markSuccess(prov.name)

        // Step 3: Save to database
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
                  address: result.address,
                  token: result.token,
                  accountId: result.id,
                  provider: result.provider,
                  expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
                },
              })
            }
          } catch {
            // DB save is non-critical
          }
        }

        return NextResponse.json(result)
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Error desconocido'
        errors.push(msg)
        markFailure(prov.name)
      }
    }

    // All providers failed
    return NextResponse.json({
      error: errors.length === 1
        ? errors[0]
        : `No se pudo crear el correo. Errores: ${errors.join(' | ')}`,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: `Error inesperado: ${message}` }, { status: 500 })
  }
}
