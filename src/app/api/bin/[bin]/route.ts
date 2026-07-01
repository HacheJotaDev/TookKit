import { NextResponse } from 'next/server'

export const revalidate = 86400 // Cache at Vercel edge for 24h (BIN data rarely changes)

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
      next: { revalidate: 86400 },
    })

    if (!res.ok) {
      return NextResponse.json({ error: 'BIN not found' }, { status: 404 })
    }

    const data = await res.json()
    return NextResponse.json(
      { country_name: data.country_name || null },
      {
        status: 200,
        headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=43200' },
      }
    )
  } catch {
    return NextResponse.json({ error: 'Lookup failed' }, { status: 500 })
  }
}