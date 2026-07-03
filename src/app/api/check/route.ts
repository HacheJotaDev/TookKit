
import { NextRequest, NextResponse } from 'next/server'

const CHKR_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15',
  Accept: 'application/json, text/plain, */*',
  Origin: 'https://chkr.cc',
  Referer: 'https://chkr.cc/',
  'Content-Type': 'application/json',
}

/** Check a single CC against chkr.cc */
async function checkSingleCc(cc: string): Promise<Record<string, unknown>> {
  const response = await fetch('https://api.chkr.cc/', {
    method: 'POST',
    headers: CHKR_HEADERS,
    body: JSON.stringify({ data: cc, charge: false }),
    signal: AbortSignal.timeout(15000),
  })
  return await response.json() as Record<string, unknown>
}

/**
 * POST — Check a single CC (backward compatible)
 * Body: { cc: string }
 */
export async function POST(req: NextRequest) {
  try {
    const { cc, ccs } = await req.json()

    // BATCH mode: array of CCs
    if (ccs && Array.isArray(ccs) && ccs.length > 0) {
      if (ccs.length > 50) {
        return NextResponse.json({ error: 'Maximum 50 CCs per batch' }, { status: 400 })
      }

      const results = await Promise.allSettled(
        ccs.map(cc => checkSingleCc(cc.trim()))
      )

      const mapped = results.map((r, i) => {
        if (r.status === 'fulfilled') {
          return { index: i, cc: ccs[i].trim(), ...r.value }
        }
        return { index: i, cc: ccs[i].trim(), status: 'error', msg: 'Check failed' }
      })

      return NextResponse.json({ results: mapped })
    }

    // SINGLE mode: backward compatible
    if (!cc || typeof cc !== 'string') {
      return NextResponse.json({ error: 'CC data is required' }, { status: 400 })
    }

    const data = await checkSingleCc(cc)
    return NextResponse.json(data)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
