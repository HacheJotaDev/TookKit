import { NextRequest, NextResponse } from 'next/server'
import { checkLine } from '@/lib/iptv-shared'

/**
 * POST — Check multiple IPTV lines in a single Vercel invocation.
 * Body: { lines: string[], inputMode: 'url' | 'combo', serverHost: string }
 * Max 20 lines per batch.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { lines, inputMode, serverHost } = body as {
      lines: string[]
      inputMode?: 'url' | 'combo'
      serverHost?: string
    }

    if (!lines || !Array.isArray(lines) || lines.length === 0) {
      return NextResponse.json({ error: 'Lines array is required' }, { status: 400 })
    }

    if (lines.length > 20) {
      return NextResponse.json({ error: 'Maximum 20 lines per batch' }, { status: 400 })
    }

    const mode: 'url' | 'combo' = inputMode || 'url'
    const host: string = serverHost || ''

    // Check all lines in parallel (server-side — 1 Vercel invocation for up to 20 lines)
    const results = await Promise.allSettled(
      lines.map(line => checkLine(line.trim(), mode, host))
    )

    const mapped = results.map((r, i) => {
      if (r.status === 'fulfilled') {
        return { index: i, line: lines[i].trim(), ...r.value }
      }
      return { index: i, line: lines[i].trim(), status: 'bad', error: 'Check failed' }
    })

    return NextResponse.json({ results: mapped })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export const dynamic = 'force-dynamic'
