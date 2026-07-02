import { NextResponse } from 'next/server'

export const maxDuration = 30

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
  country: { name: string; slug: string; code: string }
  bins: BinEntry[]
  banks: BankInfo[]
}

// Cache in memory
const cache = new Map<string, { data: Record<string, unknown>; timestamp: number }>()
const CACHE_TTL = 6 * 60 * 60 * 1000 // 6 hours

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9,es;q=0.8',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
  'Sec-Ch-Ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': '"Windows"',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1',
}

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

/**
 * Parses BIN table rows from freebinchecker HTML.
 *
 * HTML structure for each row:
 *   <tr>
 *     <td><a ... href="/bin-lookup/433126">433126</a></td>
 *     <td><a ... href="...-VISA-...">VISA</a></td>  (or empty <td></td>)
 *     <td><a ... href="...-credit-...">credit</a></td> (or empty)
 *     <td><a ... href="...-standard-...">STANDARD</a></td> (or empty)
 *   </tr>
 */
function parseBinRows(html: string): BinEntry[] {
  const bins: BinEntry[] = []

  // Match each table row that contains a /bin-lookup/ link
  // We split by </tr> to isolate rows, then parse each
  const rows = html.split(/<\/tr>/i)

  for (const row of rows) {
    // Must contain a BIN lookup link
    const binMatch = row.match(/\/bin-lookup\/(\d+)/)
    if (!binMatch) continue

    const bin = binMatch[1]

    // Find all <td> contents
    const cells: string[] = []
    const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi
    let cellMatch
    while ((cellMatch = cellRegex.exec(row)) !== null) {
      cells.push(cellMatch[1])
    }

    // cells[0] = BIN link, cells[1] = network, cells[2] = type, cells[3] = level
    const network = extractCellText(cells[1] || '')
    const type = extractCellText(cells[2] || '')
    const level = extractCellText(cells[3] || '')

    bins.push({
      bin,
      network: network.toUpperCase(),
      type: type.toLowerCase(),
      level: level.toLowerCase(),
    })
  }

  return bins
}

/** Extract visible text from a <td> cell, which may contain an <a> tag or be empty */
function extractCellText(cellHtml: string): string {
  // If there's an <a> tag, extract text between <a> and </a>
  const aMatch = cellHtml.match(/<a[^>]*>([^<]+)<\/a>/i)
  if (aMatch) return aMatch[1].trim()
  // Otherwise just strip all HTML tags
  return cellHtml.replace(/<[^>]*>/g, '').trim()
}

function parseBanks(html: string): BankInfo[] {
  const banks: BankInfo[] = []
  const bankRegex = /href="\/([^"]+)-bin-list-bank"[^>]*>([^<]+)<\/a>\s*<small>\((\d+)\s*BINs?\s*found\)<\/small>/gi
  let match
  while ((match = bankRegex.exec(html)) !== null) {
    banks.push({
      slug: match[1],
      name: cleanText(match[2]),
      count: parseInt(match[3]),
    })
  }
  return banks.sort((a, b) => b.count - a.count)
}

function parseCountryName(html: string, slug: string): string {
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i)
  if (titleMatch) {
    return cleanText(titleMatch[1]).split(' BIN List')[0].split('(')[0].trim()
  }
  return slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}

function parseCountryCode(html: string): string {
  // Try to find the country code in the info table
  const codeMatch = html.match(/>(\w{2})<\/a><\/td>\s*<td><a[^>]*href="\/[^"]+-bin-list"[^>]*>[^<]+<\/a>/)
  return codeMatch ? codeMatch[1] : ''
}

function parseBankName(html: string, fallback: string): string {
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i)
  if (titleMatch) {
    const title = cleanText(titleMatch[1])
    // Title format: "Mexico (MX) 🏦 Banco Santander ... BIN List"
    const parts = title.split(' BIN List')[0]
    // Remove country prefix like "Mexico (MX) 🏦 "
    const cleaned = parts.replace(/^[^(]+\(\w+\)\s*..?\s*/, '').trim()
    if (cleaned) return cleaned
  }
  return fallback.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}

async function fetchPage(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: BROWSER_HEADERS,
    signal: AbortSignal.timeout(20000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`)
  const text = await res.text()
  // Check if we got a Cloudflare challenge page instead of real content
  if (text.includes('cf-challenge') || text.includes('Just a moment') || text.length < 5000) {
    console.warn(`Possible Cloudflare challenge for ${url}, length=${text.length}`)
  }
  return text
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const country = searchParams.get('country')
    const bank = searchParams.get('bank')

    if (!country) {
      return NextResponse.json({ error: 'Missing country parameter' }, { status: 400 })
    }

    const cacheKey = bank ? `${country}:bank:${bank}` : `${country}:all`

    // Check cache
    const cached = cache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json(cached.data)
    }

    if (bank) {
      // ── Fetch bank-specific page ──
      const bankUrl = `https://www.freebinchecker.com/${bank}-bin-list-bank`
      const html = await fetchPage(bankUrl)

      const bins = parseBinRows(html)
      const bankName = parseBankName(html, bank)

      // Also try to get more BINs from the "more" text hint
      const moreMatch = html.match(/(\d+)\s*more\s*IIN\s*\/\s*BIN/i)
      const totalHint = moreMatch ? parseInt(moreMatch[1]) : 0

      const data = {
        bins,
        bankName,
        totalBins: bins.length + totalHint,
      }

      cache.set(cacheKey, { data, timestamp: Date.now() })
      return NextResponse.json(data, {
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
        },
      })
    } else {
      // ── Fetch country page ──
      const countryUrl = `https://www.freebinchecker.com/${country}-bin-list`
      const html = await fetchPage(countryUrl)

      const bins = parseBinRows(html)
      const banks = parseBanks(html)
      const countryName = parseCountryName(html, country)
      const countryCode = parseCountryCode(html)

      const moreMatch = html.match(/(\d+)\s*more\s*IIN\s*\/\s*BIN/i)
      const totalHint = moreMatch ? parseInt(moreMatch[1]) : 0

      const data: CountryBinData = {
        country: {
          name: countryName,
          slug: country,
          code: countryCode,
        },
        bins,
        banks,
      }

      cache.set(cacheKey, { data, timestamp: Date.now() })
      return NextResponse.json(data, {
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
        },
      })
    }
  } catch (error) {
    console.error('BIN lookup error:', error)
    return NextResponse.json(
      { error: 'Error al obtener datos. Intenta de nuevo.', details: String(error) },
      { status: 500 }
    )
  }
}
