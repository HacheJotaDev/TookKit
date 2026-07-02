import { NextResponse } from 'next/server'

export const maxDuration = 30

interface CountryInfo {
  name: string
  slug: string
  code: string
}

interface BinEntry {
  bin: string
  network: string
  type: string
  level: string
}

interface BankInfo {
  name: string
  slug: string
  count: number
}

interface CountryBinData {
  country: CountryInfo
  bins: BinEntry[]
  banks: BankInfo[]
  networks: { name: string; count: number }[]
  types: { name: string; count: number }[]
}

// Cache in memory
const countryCache = new Map<string, { data: CountryBinData; timestamp: number }>()
const CACHE_TTL = 6 * 60 * 60 * 1000 // 6 hours

function cleanText(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code)))
    .trim()
}

async function fetchCountryPage(countrySlug: string): Promise<string> {
  const url = `https://www.freebinchecker.com/${countrySlug}-bin-list`
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) throw new Error(`Failed to fetch country page: ${res.status}`)
  return await res.text()
}

function parseCountryData(html: string, countrySlug: string): CountryBinData {
  // Extract BIN list table
  const binRegex = /\/bin-lookup\/(\d+)"><\/a><\/td>\s*<td>(?:<a[^>]*>)?(\w+)(?:<\/a>)?<\/td>\s*<td>(?:<a[^>]*>)?(\w*)(?:<\/a>)?<\/td>\s*<td>(?:<a[^>]*>)?(\w*)(?:<\/a>)?<\/td>/g
  const bins: BinEntry[] = []
  let match

  while ((match = binRegex.exec(html)) !== null) {
    bins.push({
      bin: match[1],
      network: match[2].toUpperCase(),
      type: match[3]?.toLowerCase() || '',
      level: match[4]?.toLowerCase() || '',
    })
  }

  // Extract banks list
  const banks: BankInfo[] = []
  const bankRegex = /href="\/([^"]+)-bin-list-bank"[^>]*>([^<]+)<\/a>\s*<small>\((\d+)\s*BINs?\s*found\)<\/small>/g
  while ((match = bankRegex.exec(html)) !== null) {
    banks.push({
      slug: match[1],
      name: cleanText(match[2]),
      count: parseInt(match[3]),
    })
  }

  // Extract country info from title
  const titleMatch = html.match(/<title>([^<]+)<\/title>/)
  const countryName = titleMatch ? cleanText(titleMatch[1]).split(' BIN List')[0].split('(')[0].trim() : countrySlug

  // Extract country code
  const codeMatch = html.match(/>(\w{2})<\/a><\/td>\s*<td><a target="_blank" href="\/[^"]+-bin-list">([^<]+)<\/a>/)
  const code = codeMatch ? codeMatch[1] : ''

  return {
    country: {
      name: countryName,
      slug: countrySlug,
      code,
    },
    bins,
    banks,
    networks: [],
    types: [],
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const country = searchParams.get('country')
    const bank = searchParams.get('bank')

    if (!country) {
      return NextResponse.json({ error: 'Missing country parameter' }, { status: 400 })
    }

    // Check cache
    const cacheKey = `${country}${bank ? `:${bank}` : ''}`
    const cached = countryCache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json(cached.data)
    }

    let html: string

    if (bank) {
      // Fetch bank-specific page
      const bankUrl = `https://www.freebinchecker.com/${bank}-bin-list-bank`
      const res = await fetch(bankUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        signal: AbortSignal.timeout(15000),
      })
      if (!res.ok) throw new Error(`Failed to fetch bank page: ${res.status}`)
      html = await res.text()

      // Parse bank page
      const bins: BinEntry[] = []
      const binRegex = /\/bin-lookup\/(\d+)"><\/a><\/td>\s*<td>(?:<a[^>]*>)?(\w+)(?:<\/a>)?<\/td>\s*<td>(?:<a[^>]*>)?(\w*)(?:<\/a>)?<\/td>\s*<td>(?:<a[^>]*>)?(\w*)(?:<\/a>)?<\/td>/g
      let m
      while ((m = binRegex.exec(html)) !== null) {
        bins.push({
          bin: m[1],
          network: m[2].toUpperCase(),
          type: m[3]?.toLowerCase() || '',
          level: m[4]?.toLowerCase() || '',
        })
      }

      const titleMatch = html.match(/<title>([^<]+)<\/title>/)
      const bankName = titleMatch ? cleanText(titleMatch[1]).split(' BIN List')[0].replace(/^[^(]+\(\w+\)\s*/, '').trim() : bank

      const data: CountryBinData = {
        country: { name: '', slug: country, code: '' },
        bins,
        banks: [],
        networks: [],
        types: [],
      }

      countryCache.set(cacheKey, { data, timestamp: Date.now() })
      return NextResponse.json({ ...data, bankName })
    } else {
      // Fetch country page
      html = await fetchCountryPage(country)
      const data = parseCountryData(html, country)
      countryCache.set(cacheKey, { data, timestamp: Date.now() })
      return NextResponse.json(data)
    }
  } catch (error) {
    console.error('BIN country error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch BIN data. Please try again.' },
      { status: 500 }
    )
  }
}
