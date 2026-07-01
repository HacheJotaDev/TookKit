import { NextRequest, NextResponse } from 'next/server'
import { sendHitToTelegram } from '@/lib/telegram-notify'

interface HitPayload {
  host: string
  username: string
  password: string
  url?: string
  info?: Record<string, unknown>
  inputMode: 'url' | 'combo'
}

/**
 * POST — Send IPTV hit notification(s) to Telegram.
 * NO DATABASE NEEDED — just forwards hit info to Telegram Bot API.
 * Body: { host, username, password, url?, info?, inputMode }
 *   OR: { hits: HitPayload[] }  (batch mode)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Batch mode: array of hits
    if (body.hits && Array.isArray(body.hits)) {
      const hits = body.hits as HitPayload[]
      await Promise.allSettled(
        hits.map(h => {
          if (!h.host || !h.username || !h.password) return Promise.resolve()
          return sendHitToTelegram(h).catch(() => {})
        })
      )
      return NextResponse.json({ ok: true, sent: hits.length })
    }

    // Single hit mode
    const { host, username, password, url, info, inputMode } = body as HitPayload
    if (!host || !username || !password) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    try {
      await sendHitToTelegram({ host, username, password, url, info, inputMode })
    } catch (tgError) {
      console.error('[/api/telegram/hit] Telegram send failed:', tgError)
    }

    return NextResponse.json({ ok: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export const dynamic = 'force-dynamic'
