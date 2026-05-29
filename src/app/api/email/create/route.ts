
import { NextRequest, NextResponse } from 'next/server'

// This route now serves TWO purposes:
// 1. Accept pre-created account data from client (direct mail.tm mode) → save to DB
// 2. Legacy fallback: create account server-side if client sends empty POST

const MAIL_PROVIDERS = [
  { name: 'mail.tm', baseUrl: 'https://api.mail.tm' },
  { name: 'mail.gw', baseUrl: 'https://api.mail.gw' },
]

const API_HEADERS: Record<string, string> = {
  'Accept': 'application/ld+json',
  'Content-Type': 'application/json',
}

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 15000): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timeoutId)
  }
}

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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // ── Mode 1: Client already created account, just save to DB ──
    if (body.address && body.token && body.id) {
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
                address: body.address,
                token: body.token,
                accountId: body.id,
                provider: body.provider || 'mail.tm',
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
              },
            })
          }
        } catch {
          // DB save is non-critical
        }
      }
      return NextResponse.json({ saved: true })
    }

    // ── Mode 2: Legacy server-side creation (fallback) ──
    // Find available domain
    let domain = 'wshu.net'
    let provider = MAIL_PROVIDERS[0]

    for (const prov of MAIL_PROVIDERS) {
      try {
        const res = await fetchWithTimeout(`${prov.baseUrl}/domains`, {
          headers: { Accept: 'application/ld+json' },
        })
        if (res.ok) {
          const data = await res.json()
          const domains = extractDomains(data)
          const active = domains.filter(d => d.isActive && d.domain)
          if (active.length > 0) {
            domain = active[0].domain
            provider = prov
            break
          }
        }
      } catch {
        // Try next
      }
    }

    const baseUrl = provider.baseUrl
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
    let username = ''
    for (let i = 0; i < 10; i++) {
      username += chars[Math.floor(Math.random() * chars.length)]
    }
    const address = `${username}@${domain}`
    const password = 'Tp' + Array.from({ length: 12 }, () =>
      'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[Math.floor(Math.random() * 62)]
    ).join('') + '!1'

    // Create account with retry
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

      if (createRes.status === 422) break
      if (attempt < 2) await new Promise(r => setTimeout(r, 2000 * (attempt + 1)))
    }

    if (!accountData) {
      return NextResponse.json({ error: 'No se pudo crear la cuenta. Intenta de nuevo.' })
    }

    const accountId = String(accountData.id || '')

    // Get token with retry
    let token = ''
    for (let attempt = 0; attempt < 3; attempt++) {
      const tokenRes = await fetchWithTimeout(`${baseUrl}/token`, {
        method: 'POST',
        headers: API_HEADERS,
        body: JSON.stringify({ address, password }),
      })
      if (tokenRes.ok) {
        const tokenData = await tokenRes.json()
        token = tokenData.token || ''
        if (token) break
      }
      if (attempt < 2) await new Promise(r => setTimeout(r, 1500 * (attempt + 1)))
    }

    if (!token) {
      return NextResponse.json({ error: 'No se pudo obtener el token.' })
    }

    // Save to DB
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
              accountId,
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
