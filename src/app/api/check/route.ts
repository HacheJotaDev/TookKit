
import { NextRequest } from 'next/server'
export async function POST(req: NextRequest) {
  try {
    const { cc } = await req.json()

    if (!cc || typeof cc !== 'string') {
      return new Response(JSON.stringify({ error: 'CC data is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Send the actual check request
    const response = await fetch('https://api.chkr.cc/', {
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15',
        Accept: 'application/json, text/plain, */*',
        Origin: 'https://chkr.cc',
        Referer: 'https://chkr.cc/',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        data: cc,
        charge: false,
      }),
    })

    const data = await response.json()

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
