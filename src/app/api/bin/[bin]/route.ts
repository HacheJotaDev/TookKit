import { NextResponse } from 'next/server'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ bin: string }> }
) {
  try {
    const { bin } = await params
    const clean = bin.replace(/[^0-9]/g, '').slice(0, 8)
    if (clean.length < 6) {
      return NextResponse.json({ error: 'BIN too short' }, { status: 400 })
    }

    const res = await fetch(`https://bins.antipublic.cc/bins/${clean}`, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(8000),
    })

    if (!res.ok) {
      return NextResponse.json({ error: 'BIN not found' }, { status: 404 })
    }

    const data = await res.json()
    // Return only what we need
    return NextResponse.json({
      country_name: data.country_name || null,
      country_flag: data.country_flag || null,
    })
  } catch {
    return NextResponse.json({ error: 'Lookup failed' }, { status: 500 })
  }
}