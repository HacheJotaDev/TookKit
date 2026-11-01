import { NextRequest, NextResponse } from 'next/server'

// ─────────────────────────────────────────────────────────────
// Proxy server-side para la API de mail.tm / mail.gw.
// mail.tm ya NO devuelve cabeceras CORS (access-control-allow-origin),
// por lo que las llamadas directas desde el navegador fallan siempre.
// Este proxy hace las peticiones desde el servidor (sin CORS) y se usa
// como respaldo del proveedor principal (GuerrillaMail, CORS abierto).
// Uso: /api/email/<ruta>?provider=mail.tm|mail.gw
// ─────────────────────────────────────────────────────────────

export const dynamic = 'force-dynamic'

const PROVIDERS: Record<string, string> = {
  'mail.tm': 'https://api.mail.tm',
  'mail.gw': 'https://api.mail.gw',
}

async function proxy(req: NextRequest, path: string[]) {
  const provider = req.nextUrl.searchParams.get('provider') || 'mail.tm'
  const base = PROVIDERS[provider] || PROVIDERS['mail.tm']
  const url = new URL(`${base}/${path.join('/')}`)

  // Reenviar query params (excepto "provider")
  req.nextUrl.searchParams.forEach((v, k) => {
    if (k !== 'provider') url.searchParams.set(k, v)
  })

  const headers: Record<string, string> = {
    'Accept': 'application/ld+json',
    'User-Agent': 'TookKit/1.0 (+https://github.com/HacheJotaDev/TookKit)',
  }
  const auth = req.headers.get('authorization')
  if (auth) headers['Authorization'] = auth

  const init: RequestInit = { method: req.method, headers, cache: 'no-store' }
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    headers['Content-Type'] = 'application/json'
    init.body = await req.text()
  }

  try {
    const res = await fetch(url.toString(), init)
    const text = await res.text()
    return new NextResponse(text, {
      status: res.status,
      headers: {
        'Content-Type': res.headers.get('content-type') || 'application/json',
        'Cache-Control': 'no-store',
      },
    })
  } catch {
    // Upstream caído o inalcanzable (p. ej. api.mail.gw fuera de servicio)
    return NextResponse.json({ error: 'upstream_unreachable' }, { status: 502 })
  }
}

type Ctx = { params: Promise<{ path: string[] }> }

export async function GET(req: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params
  return proxy(req, path)
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params
  return proxy(req, path)
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params
  return proxy(req, path)
}
