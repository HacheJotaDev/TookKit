'use client'

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CreditCard, Search, Tv, Mail, Settings, Copy, Check, Play,
  Trash2, RefreshCw, ChevronDown, Info, Moon, Sun,
  X, Loader2, Square, Send, ExternalLink, Zap, Upload, AlertTriangle,
  MessageCircle, Phone, Share2, MapPin, Landmark
} from 'lucide-react'
import { toast } from 'sonner'
import { IptvChecker } from '@/components/iptv/iptv-checker'
import { apiFetch } from '@/lib/api-config'
import { IBAN_COUNTRIES, generateIban, formatIban, type IbanCountry } from '@/lib/iban-data'

// ============================================================
// BIN CACHE (module-level, persists across re-renders)
// ============================================================
const binCache = new Map<string, { country_name: string }>()

// ============================================================
// TYPES
// ============================================================

type TabId = 'cards' | 'checker' | 'iptv' | 'email' | 'address' | 'iban' | 'settings'

interface GeneratedCard {
  number: string
  month: string
  year: string
  cvv: string
  type: string
}

interface CheckResult {
  cc: string
  status: 'live' | 'dead' | 'checking' | 'error'
  message?: string
  brand?: string
  bank?: string
}

interface EmailAccount {
  address: string
  token: string
  id: string
  provider: string
}

interface EmailMessage {
  id: string
  from: { address: string; name: string }
  subject: string
  createdAt: string
  intro?: string
}

interface GeneratedAddress {
  street: string
  city: string
  state: string
  country: string
  postcode: string
  phone: string
}

// ─── Direct mail.tm API client (bypasses Vercel proxy) ────
// mail.tm allows CORS from any origin (access-control-allow-origin: *)
// Calling directly avoids Vercel's IP-based rate limiting issues

const MAIL_TM_BASE = 'https://api.mail.tm'
const MAIL_PROVIDERS = [
  { name: 'mail.tm', baseUrl: 'https://api.mail.tm' },
  { name: 'mail.gw', baseUrl: 'https://api.mail.gw' },
]

async function mailFetch(path: string, options: RequestInit = {}, provider?: string): Promise<Response> {
  const baseUrl = provider && provider !== 'mail.tm'
    ? MAIL_PROVIDERS.find(p => p.name === provider)?.baseUrl || MAIL_TM_BASE
    : MAIL_TM_BASE
  return fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'Accept': 'application/ld+json',
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
}

async function getAvailableDomain(): Promise<{ domain: string; provider: string }> {
  for (const prov of MAIL_PROVIDERS) {
    try {
      const res = await fetch(`${prov.baseUrl}/domains`, {
        headers: { Accept: 'application/ld+json' },
      })
      if (res.ok) {
        const data = await res.json()
        const members = data['hydra:member'] || data
        if (Array.isArray(members)) {
          const active = members.filter((d: Record<string, unknown>) => d.isActive !== false && d.domain)
          if (active.length > 0) {
            return { domain: active[0].domain as string, provider: prov.name }
          }
        }
      }
    } catch {
      // Try next provider
    }
  }
  // Hardcoded fallback
  return { domain: 'wshu.net', provider: 'mail.tm' }
}

// ============================================================
// UTILITY: Debounce hook
// ============================================================

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value)
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(handler)
  }, [value, delay])
  return debouncedValue
}

// ============================================================
// LUHN ALGORITHM
// ============================================================

function luhnCheckDigit(digits: string): number {
  let sum = 0
  let alternate = true
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = parseInt(digits[i], 10)
    if (alternate) {
      n *= 2
      if (n > 9) n -= 9
    }
    sum += n
    alternate = !alternate
  }
  return (10 - (sum % 10)) % 10
}

function generateCardFromBin(bin: string, cardType: string, customMonth?: string, customYear?: string): GeneratedCard {
  let base = ''
  for (const ch of bin) {
    if (ch === 'x' || ch === 'X') {
      base += Math.floor(Math.random() * 10).toString()
    } else if (/\d/.test(ch)) {
      base += ch
    }
  }

  const isAmex = cardType === 'amex'
  const targetLength = isAmex ? 15 : 16

  while (base.length < targetLength - 1) {
    base += Math.floor(Math.random() * 10).toString()
  }

  base = base.substring(0, targetLength - 1)

  const checkDigit = luhnCheckDigit(base)
  const fullNumber = base + checkDigit.toString()

  const month = customMonth && customMonth.trim() !== ''
    ? customMonth.padStart(2, '0')
    : String(Math.floor(Math.random() * 12) + 1).padStart(2, '0')
  const year = customYear && customYear.trim() !== ''
    ? customYear
    : (new Date().getFullYear() + Math.floor(Math.random() * 5) + 1).toString()

  const cvv = isAmex
    ? String(Math.floor(Math.random() * 9000) + 1000)
    : String(Math.floor(Math.random() * 900) + 100)

  return { number: fullNumber, month, year, cvv, type: cardType }
}

function formatCardNumber(num: string): string {
  return num.replace(/(.{4})/g, '$1 ').trim()
}

function detectCardType(bin: string): string {
  const firstDigit = bin.replace(/[xX]/g, '0')[0]
  if (firstDigit === '4') return 'visa'
  if (firstDigit === '5') return 'mastercard'
  if (firstDigit === '3') return 'amex'
  if (firstDigit === '6') return 'discover'
  return 'random'
}

// ============================================================
// TAB CONFIG
// ============================================================

const tabs: { id: TabId; label: string; icon: typeof CreditCard }[] = [
  { id: 'cards', label: 'Tarjetas', icon: CreditCard },
  { id: 'checker', label: 'Checker', icon: Search },
  { id: 'iptv', label: 'IPTV', icon: Tv },
  { id: 'email', label: 'Correo', icon: Mail },
  { id: 'address', label: 'Direcciones', icon: MapPin },
  { id: 'iban', label: 'IBAN', icon: Landmark },
  { id: 'settings', label: 'Ajustes', icon: Settings },
]

// ============================================================
// MAIN APP COMPONENT
// ============================================================

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabId>('cards')

  return (
    <div className="min-h-screen theme-text flex flex-col" style={{ background: 'var(--app-bg)', color: 'var(--app-text)' }}>
      {/* Header */}
      <header className="sticky top-0 z-40 backdrop-blur-xl border-b px-4 py-3" style={{ background: 'var(--app-header)', borderColor: 'var(--app-card-border)' }}>
        <div className="flex items-center justify-center gap-3">
          <div className="relative">
            <div className="absolute -inset-1.5 bg-amber-500/20 rounded-xl blur-md" />
            <img src="/logo.svg" alt="HJTools X" className="relative w-7 h-7 rounded-lg" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <h1 className="text-lg font-bold tracking-tight">
              <span className="text-amber-500">HJTools</span>
            </h1>
            <span className="text-[10px] font-bold text-amber-500/60 bg-amber-500/10 px-1.5 py-0.5 rounded-md tracking-widest">X</span>
          </div>
        </div>
      </header>

      {/* Content Area */}
      <main className="flex-1 overflow-y-auto pb-20">
        {(['cards', 'checker', 'iptv', 'email', 'address', 'iban', 'settings'] as TabId[]).map(tabId => (
          <div
            key={tabId}
            className={activeTab === tabId ? 'px-4 py-4' : 'hidden'}
          >
            {tabId === 'cards' && <CardsTab />}
            {tabId === 'checker' && <CheckerTab />}
            {tabId === 'iptv' && <IptvTab />}
            {tabId === 'email' && <EmailTab />}
            {tabId === 'address' && <AddressTab />}
            {tabId === 'iban' && <IbanTab />}
            {tabId === 'settings' && <SettingsTab />}
          </div>
        ))}
      </main>

      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t" style={{ background: 'var(--app-nav)', borderColor: 'var(--app-card-border)' }}>
        <div className="backdrop-blur-xl">
          <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-1">
            {tabs.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="relative flex flex-col items-center justify-center gap-0.5 flex-1 py-1.5 rounded-2xl transition-all duration-300"
                >
                  {isActive && (
                    <motion.div
                      layoutId="nav-pill"
                      className="absolute inset-y-1.5 inset-x-2 rounded-2xl bg-amber-500/15 border border-amber-500/20"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                  <div className={`relative z-10 ${isActive ? 'scale-110' : ''} transition-transform duration-200`}>
                    <Icon className="w-5 h-5 transition-colors duration-200" style={{ color: isActive ? '#f59e0b' : undefined }} strokeWidth={isActive ? 2.2 : 1.5} />
                  </div>
                  <span className={`relative z-10 text-[10px] transition-colors duration-200 ${isActive ? 'font-bold text-amber-500' : 'font-medium'}`} style={!isActive ? { color: 'var(--app-text-dim)' } : undefined}>
                    {tab.label}
                  </span>
                </button>
              )
            })}
          </div>
          <div className="h-[env(safe-area-inset-bottom)]" />
        </div>
      </nav>
    </div>
  )
}

// ============================================================
// TAB 1: CREDIT CARD GENERATOR
// ============================================================

interface BinInfo {
  flag: string
  country_name: string
}

function CardsTab() {
  const [bin, setBin] = useState('')
  const [quantity, setQuantity] = useState('10')
  const [customMonth, setCustomMonth] = useState('')
  const [customYear, setCustomYear] = useState('')
  const [cards, setCards] = useState<GeneratedCard[]>([])
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)
  const [copiedAll, setCopiedAll] = useState(false)
  const [binInfo, setBinInfo] = useState<BinInfo | null>(null)
  const [binLoading, setBinLoading] = useState(false)

  // Debounced BIN lookup (with client-side cache to avoid repeated host calls)
  const debouncedBin = useDebounce(bin.replace(/[^0-9]/g, '').slice(0, 6), 500)
  useEffect(() => {
    if (debouncedBin.length >= 6) {
      // Check cache first
      const cached = binCache.get(debouncedBin)
      if (cached) {
        setBinInfo({ flag: '', country_name: cached.country_name })
        return
      }
      setBinLoading(true)
      fetch(`/api/bin/${debouncedBin}`)
        .then(r => r.ok ? r.json() : null)
        .then((data: { country_name?: string } | null) => {
          const info = data?.country_name ? { flag: '', country_name: data.country_name } : null
          if (info) binCache.set(debouncedBin, { country_name: info.country_name })
          setBinInfo(info)
        })
        .catch(() => setBinInfo(null))
        .finally(() => setBinLoading(false))
    } else {
      setBinInfo(null)
    }
  }, [debouncedBin])

  const handleGenerate = useCallback(() => {
    if (!bin.trim()) {
      toast.error('Ingresa un BIN válido')
      return
    }
    const qty = Math.min(Math.max(parseInt(quantity) || 1, 1), 100)
    const type = detectCardType(bin)
    const m = customMonth.trim() || undefined
    const y = customYear.trim() || undefined
    const generated: GeneratedCard[] = []
    for (let i = 0; i < qty; i++) {
      generated.push(generateCardFromBin(bin.trim(), type, m, y))
    }
    setCards(generated)
    toast.success(`${qty} tarjeta${qty > 1 ? 's' : ''} generada${qty > 1 ? 's' : ''}`)
  }, [bin, quantity, customMonth, customYear])

  const copyCard = useCallback(async (card: GeneratedCard, idx: number) => {
    const text = `${card.number}|${card.month}|${card.year}|${card.cvv}`
    await navigator.clipboard.writeText(text)
    setCopiedIdx(idx)
    toast.success('Copiado al portapapeles')
    setTimeout(() => setCopiedIdx(null), 1500)
  }, [])

  const copyAll = useCallback(async () => {
    if (cards.length === 0) return
    const text = cards.map(c => `${c.number}|${c.month}|${c.year}|${c.cvv}`).join('\n')
    await navigator.clipboard.writeText(text)
    setCopiedAll(true)
    toast.success(`${cards.length} tarjetas copiadas`)
    setTimeout(() => setCopiedAll(false), 2000)
  }, [cards])

  return (
    <div className="space-y-4">
      {/* BIN Input */}
      <div className="bg-[#111113] theme-card rounded-xl border border-white/[0.06] p-4 space-y-3">
        <label className="text-xs font-medium text-white/50 theme-text-dim uppercase tracking-wider">BIN / Plantilla</label>
        <input
          type="text"
          value={bin}
          onChange={(e) => setBin(e.target.value)}
          placeholder="4532xxxx o 5234xxxxxxxx"
          className="w-full bg-[#09090b] theme-input border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white theme-text placeholder-white/20 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 font-mono transition-colors"
        />
        <div className="flex gap-2">
          <input
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            min="1"
            max="100"
            placeholder="Cantidad"
            className="w-20 bg-[#09090b] theme-input border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white theme-text placeholder-white/20 focus:outline-none focus:border-amber-500/50 font-mono transition-colors"
          />
          <select
            value={customMonth}
            onChange={(e) => setCustomMonth(e.target.value)}
            className="flex-1 bg-[#09090b] theme-input border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white theme-text focus:outline-none focus:border-amber-500/50 transition-colors"
          >
            <option value="">Mes (Rnd)</option>
            {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <select
            value={customYear}
            onChange={(e) => setCustomYear(e.target.value)}
            className="flex-1 bg-[#09090b] theme-input border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white theme-text focus:outline-none focus:border-amber-500/50 transition-colors"
          >
            <option value="">Año (Rnd)</option>
            {Array.from({ length: 10 }, (_, i) => {
              const y = (new Date().getFullYear() + i).toString()
              return <option key={y} value={y}>{y}</option>
            })}
          </select>
        </div>
        <button
          onClick={handleGenerate}
          className="w-full bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-black font-bold rounded-xl py-3 text-sm transition-all duration-300 flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 active:scale-[0.98]"
        >
          <Zap className="w-4 h-4" />
          Generar
        </button>
      </div>

      {/* Results */}
      {cards.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-white/40 theme-text-dim">{cards.length} resultado{cards.length > 1 ? 's' : ''}</span>
            <button
              onClick={copyAll}
              className="flex items-center gap-1.5 text-xs text-amber-500 hover:text-amber-400 transition-colors"
            >
              {copiedAll ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              Copiar Todo
            </button>
          </div>

          <div className="max-h-[60vh] overflow-y-auto space-y-2 custom-scrollbar">
            {cards.map((card, idx) => (
              <motion.div
                key={`${card.number}-${idx}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.02, duration: 0.3 }}
                className="relative rounded-xl border border-white/[0.06] overflow-hidden group"
                style={{ background: 'linear-gradient(135deg, var(--app-card-gradient-from, #1a1a2e), var(--app-card-gradient-to, #111113))' }}
              >
                {/* Left accent line */}
                <div className={`absolute left-0 top-0 bottom-0 w-0.5 ${
                  card.type === 'visa' ? 'bg-blue-500' :
                  card.type === 'mastercard' ? 'bg-orange-500' :
                  card.type === 'amex' ? 'bg-green-500' :
                  'bg-amber-500'
                }`} />
                <div className="p-3.5 pl-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded ${
                          card.type === 'visa' ? 'bg-blue-500/15 text-blue-400' :
                          card.type === 'mastercard' ? 'bg-orange-500/15 text-orange-400' :
                          card.type === 'amex' ? 'bg-green-500/15 text-green-400' :
                          'bg-amber-500/15 text-amber-400'
                        }`}>
                          {card.type}
                        </span>
                        {binInfo && (
                          <span className="text-[10px] font-medium" style={{ color: 'var(--app-text-dim)' }}>{binInfo.country_name}</span>
                        )}
                      </div>
                      <p className="font-mono text-sm tracking-wider" style={{ color: 'var(--app-text-90)' }}>
                        {formatCardNumber(card.number)}
                      </p>
                      <div className="flex gap-4 text-xs font-mono" style={{ color: 'var(--app-text-dim)' }}>
                        <span>{card.month}/{card.year}</span>
                        <span>CVV: {card.cvv}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => copyCard(card, idx)}
                      className="p-2 rounded-lg hover:bg-white/[0.06] transition-all duration-200 active:scale-95 shrink-0"
                    >
                      {copiedIdx === idx ? (
                        <Check className="w-4 h-4 text-green-500" />
                      ) : (
                        <Copy className="w-4 h-4 transition-colors duration-200" style={{ color: 'var(--app-text-dim)' }} />
                      )}
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================
// TAB 2: CCS CHECKER
// ============================================================

function CheckerTab() {
  const [ccList, setCcList] = useState('')
  const [results, setResults] = useState<CheckResult[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [stats, setStats] = useState({ total: 0, live: 0, dead: 0 })
  const stopRef = useRef(false)

  const startCheck = useCallback(async () => {
    const lines = ccList.trim().split('\n').filter(l => l.trim())
    if (lines.length === 0) {
      toast.error('Ingresa al menos una tarjeta')
      return
    }

    setIsRunning(true)
    stopRef.current = false
    setResults([])
    setStats({ total: 0, live: 0, dead: 0 })

    let total = 0
    let live = 0
    let dead = 0

    for (const line of lines) {
      if (stopRef.current) break

      const cc = line.trim()
      if (!cc) continue

      setResults(prev => [...prev, { cc, status: 'checking' }])

      try {
        const res = await apiFetch('/api/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cc }),
        })
        const data = await res.json()

        total++

        const isLive = data.code === 1 || data.status === 'Live' || data.msg?.toLowerCase().includes('live') || data.msg?.toLowerCase().includes('approved')

        if (isLive) {
          live++
          setResults(prev =>
            prev.map((r, i) =>
              i === prev.length - 1
                ? { ...r, status: 'live', message: data.msg || 'Aprobada', brand: data.brand || data.type, bank: data.bank || data.issuer }
                : r
            )
          )
        } else {
          dead++
          setResults(prev =>
            prev.map((r, i) =>
              i === prev.length - 1
                ? { ...r, status: 'dead', message: data.msg || data.message || 'Rechazada' }
                : r
            )
          )
        }

        setStats({ total, live, dead })
      } catch {
        dead++
        total++
        setResults(prev =>
          prev.map((r, i) =>
            i === prev.length - 1 ? { ...r, status: 'error', message: 'Error de conexión' } : r
          )
        )
        setStats({ total, live, dead })
      }

      await new Promise(r => setTimeout(r, 500))
    }

    setIsRunning(false)
    toast.success(`Listo: ${live} aprobadas, ${dead} rechazadas`)
  }, [ccList])

  const stopCheck = useCallback(() => {
    stopRef.current = true
    setIsRunning(false)
    toast.info('Proceso detenido')
  }, [])

  const liveResults = results.filter(r => r.status === 'live')
  const dotResults = results.filter(r => r.status === 'dead' || r.status === 'error')

  return (
    <div className="space-y-4">
      {/* Input */}
      <div className="bg-[#111113] theme-card rounded-xl border border-white/[0.06] p-4 space-y-3">
        <label className="text-xs font-medium text-white/50 theme-text-dim uppercase tracking-wider">Lista de CC</label>
        <textarea
          value={ccList}
          onChange={(e) => setCcList(e.target.value)}
          placeholder="4147181496481361|09|2028|010&#10;4147181496481362|10|2027|011"
          rows={4}
          className="w-full bg-[#09090b] theme-input border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white theme-text placeholder-white/20 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 font-mono resize-none transition-colors"
        />
        <div className="flex gap-2">
          <button
            onClick={startCheck}
            disabled={isRunning}
            className="flex-1 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold rounded-xl py-3 text-sm transition-all duration-300 flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 active:scale-[0.98]"
          >
            {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {isRunning ? 'Analizando...' : 'Verificar'}
          </button>
          {isRunning && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={stopCheck}
              className="bg-red-500/15 hover:bg-red-500/25 border border-red-500/20 text-red-400 font-bold rounded-xl px-5 py-3 text-sm transition-all duration-200 flex items-center gap-2 active:scale-[0.98]"
            >
              <Square className="w-4 h-4" />
              Detener
            </motion.button>
          )}
        </div>
      </div>

      {/* Stats */}
      {stats.total > 0 && (
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl border border-white/[0.06] p-3 text-center" style={{ background: 'var(--app-card)' }}>
            <p className="text-xl font-bold font-mono" style={{ color: 'var(--app-text)' }}>{stats.total}</p>
            <p className="text-[10px] uppercase tracking-wider font-medium mt-0.5" style={{ color: 'var(--app-text-dim)' }}>Total</p>
          </div>
          <div className="rounded-xl border border-green-500/20 p-3 text-center bg-green-500/5">
            <p className="text-xl font-bold font-mono text-green-500">{stats.live}</p>
            <p className="text-[10px] uppercase tracking-wider font-medium mt-0.5 text-green-500/60">Aprobadas</p>
          </div>
          <div className="rounded-xl border border-red-500/20 p-3 text-center bg-red-500/5">
            <p className="text-xl font-bold font-mono text-red-500">{stats.dead}</p>
            <p className="text-[10px] uppercase tracking-wider font-medium mt-0.5 text-red-500/60">Rechazadas</p>
          </div>
        </div>
      )}

      {/* Live Results */}
      {liveResults.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-medium text-green-500/70 uppercase tracking-wider">Aprobadas</h3>
            <div className="flex-1 h-px bg-green-500/10" />
          </div>
          <div className="max-h-48 overflow-y-auto space-y-1.5 custom-scrollbar">
            {liveResults.map((r, i) => (
              <motion.div
                key={`live-${i}`}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-green-500/5 border border-green-500/20 rounded-xl px-4 py-3 flex items-center justify-between"
              >
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <p className="text-xs font-mono text-green-400 font-medium">{r.cc}</p>
                  </div>
                  {r.message && <p className="text-[10px] text-green-500/50 ml-4">{r.message}</p>}
                  {(r.brand || r.bank) && (
                    <p className="text-[10px] ml-4 mt-0.5" style={{ color: 'var(--app-text-dim)' }}>
                      {[r.brand, r.bank].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => { navigator.clipboard.writeText(r.cc); toast.success('Copiado') }}
                  className="p-1.5 hover:bg-green-500/10 rounded-lg transition-colors"
                >
                  <Copy className="w-3.5 h-3.5 text-green-500/50" />
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Dead dots */}
      {dotResults.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-medium text-red-500/70 uppercase tracking-wider">Rechazadas</h3>
            <div className="flex-1 h-px bg-red-500/10" />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {dotResults.map((_, i) => (
              <div key={`dead-${i}`} className="w-1.5 h-1.5 rounded-full bg-red-500/30" />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================
// TAB 3: IPTV CHECKER
// ============================================================

function IptvTab() {
  return <IptvChecker />
}

// IptvChecker moved to @/components/iptv/iptv-checker.tsx

// ============================================================
// TAB 4: TEMPORARY EMAIL — With persistence
// ============================================================

function EmailTab() {
  const [account, setAccount] = useState<EmailAccount | null>(null)
  const [messages, setMessages] = useState<EmailMessage[]>([])
  const [selectedMsg, setSelectedMsg] = useState<{ id: string; from: string; subject: string; body: string } | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [isLoadingMsg, setIsLoadingMsg] = useState(false)
  const [copiedEmail, setCopiedEmail] = useState(false)
  const [tokenExpired, setTokenExpired] = useState(false)
  const [isRecovering, setIsRecovering] = useState(true)
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Sanitize HTML to prevent XSS attacks from email content
  const sanitizeHtml = useCallback((html: string): string => {
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
      .replace(/<embed\b[^>]*>/gi, '')
      .replace(/<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi, '')
      .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
      .replace(/javascript\s*:/gi, '')
      .replace(/<meta\b[^>]*>/gi, '')
      .replace(/<link\b[^>]*>/gi, '')
      .replace(/<base\b[^>]*>/gi, '')
  }, [])

  // Try to recover email from server DB or localStorage on mount
  useEffect(() => {
    const recoverEmail = async () => {
      // First try localStorage (fast, works offline)
      try {
        const saved = localStorage.getItem('toolkit_email')
        if (saved) {
          const parsed = JSON.parse(saved) as EmailAccount
          if (parsed.address && parsed.token && parsed.id) {
            setAccount(parsed)
            setIsRecovering(false)
            return
          }
        }
      } catch {}

      // Email recovery is 100% client-side via localStorage (no server needed)

      setIsRecovering(false)
    }

    recoverEmail()
  }, [])

  // Save account to localStorage whenever it changes
  useEffect(() => {
    if (account) {
      try {
        localStorage.setItem('toolkit_email', JSON.stringify(account))
      } catch {}
    } else {
      try {
        localStorage.removeItem('toolkit_email')
      } catch {}
    }
  }, [account])

  const createEmail = useCallback(async () => {
    setIsCreating(true)
    setTokenExpired(false)

    try {
      // ── DIRECT to mail.tm (bypasses Vercel) ──
      // mail.tm has CORS: access-control-allow-origin: *
      // Step 1: Get available domain
      const { domain, provider } = await getAvailableDomain()
      const baseUrl = provider === 'mail.gw' ? 'https://api.mail.gw' : 'https://api.mail.tm'

      // Step 2: Generate random email address
      const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
      let username = ''
      for (let i = 0; i < 10; i++) {
        username += chars[Math.floor(Math.random() * chars.length)]
      }
      const address = `${username}@${domain}`
      const password = 'Tp' + Array.from({ length: 12 }, () =>
        'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[Math.floor(Math.random() * 62)]
      ).join('') + '!1'

      // Step 3: Create account (with retry)
      let accountData: Record<string, unknown> | null = null
      for (let attempt = 0; attempt < 3; attempt++) {
        const createRes = await fetch(`${baseUrl}/accounts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/ld+json' },
          body: JSON.stringify({ address, password }),
        })

        if (createRes.ok) {
          accountData = await createRes.json()
          break
        }

        // 422 = bad address, don't retry
        if (createRes.status === 422) {
          toast.error('Error al crear cuenta. Intentando de nuevo...')
          // Try with a different username
          username = ''
          for (let i = 0; i < 10; i++) {
            username += chars[Math.floor(Math.random() * chars.length)]
          }
          continue
        }

        // 429/5xx = rate limit or server error, retry with backoff
        if (attempt < 2) {
          await new Promise(r => setTimeout(r, 2000 * (attempt + 1)))
        }
      }

      if (!accountData) {
        toast.error('No se pudo crear la cuenta. Intenta de nuevo.')
        return
      }

      const accountId = String(accountData.id || '')

      // Step 4: Get JWT token
      let token = ''
      for (let attempt = 0; attempt < 3; attempt++) {
        const tokenRes = await fetch(`${baseUrl}/token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/ld+json' },
          body: JSON.stringify({ address, password }),
        })

        if (tokenRes.ok) {
          const tokenData = await tokenRes.json()
          token = tokenData.token || ''
          if (token) break
        }

        if (attempt < 2) {
          await new Promise(r => setTimeout(r, 1500 * (attempt + 1)))
        }
      }

      if (!token) {
        toast.error('No se pudo obtener el token. Intenta de nuevo.')
        return
      }

      const newAccount: EmailAccount = {
        address,
        token,
        id: accountId,
        provider,
      }
      setAccount(newAccount)
      setMessages([])
      setSelectedMsg(null)
      toast.success('Correo temporal creado')

      // Email is fully client-side — no server DB save needed

    } catch {
      toast.error('Error al crear correo. Verifica tu conexión.')
    } finally {
      setIsCreating(false)
    }
  }, [])

  const fetchMessages = useCallback(async (token?: string) => {
    const t = token || account?.token
    const p = account?.provider || 'mail.tm'
    if (!t) return

    try {
      // ── DIRECT to mail.tm (bypasses Vercel) ──
      const baseUrl = p === 'mail.gw' ? 'https://api.mail.gw' : 'https://api.mail.tm'
      const res = await fetch(`${baseUrl}/messages`, {
        headers: {
          'Accept': 'application/ld+json',
          'Authorization': `Bearer ${t}`,
        },
      })

      if (res.status === 401) {
        setTokenExpired(true)
        toast.error('Token expirado — genera un nuevo correo')
        return
      }

      const data = await res.json()
      if (data.error) return

      const msgs = data['hydra:member'] || data
      setMessages(Array.isArray(msgs) ? msgs : [])
    } catch {
      // Silent fail for auto-refresh
    }
  }, [account])

  const openMessage = useCallback(async (msg: EmailMessage) => {
    if (!account?.token) return
    setIsLoadingMsg(true)

    try {
      // ── DIRECT to mail.tm (bypasses Vercel) ──
      const baseUrl = account.provider === 'mail.gw' ? 'https://api.mail.gw' : 'https://api.mail.tm'
      const res = await fetch(`${baseUrl}/messages/${msg.id}`, {
        headers: {
          'Accept': 'application/ld+json',
          'Authorization': `Bearer ${account.token}`,
        },
      })
      const data = await res.json()

      if (data.error) {
        toast.error(data.error)
        return
      }

      const htmlContent = Array.isArray(data.html)
        ? data.html.join('')
        : (typeof data.html === 'string' ? data.html : '')

      const body = htmlContent || data.text || msg.intro || 'Sin contenido'

      setSelectedMsg({
        id: data.id,
        from: data.from?.address || msg.from.address,
        subject: data.subject || msg.subject,
        body: sanitizeHtml(body),
      })
    } catch {
      toast.error('Error al cargar mensaje')
    } finally {
      setIsLoadingMsg(false)
    }
  }, [account, sanitizeHtml])

  const deleteAccount = useCallback(async () => {
    if (!account) return

    try {
      // ── DIRECT to mail.tm (bypasses Vercel) ──
      const baseUrl = account.provider === 'mail.gw' ? 'https://api.mail.gw' : 'https://api.mail.tm'
      await fetch(`${baseUrl}/accounts/${account.id}`, {
        method: 'DELETE',
        headers: {
          'Accept': 'application/ld+json',
          'Authorization': `Bearer ${account.token}`,
        },
      })

      setAccount(null)
      setMessages([])
      setSelectedMsg(null)
      setTokenExpired(false)
      if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current)
      toast.success('Cuenta eliminada')
    } catch {
      toast.error('Error al eliminar cuenta')
    }
  }, [account])

  const copyEmail = useCallback(async () => {
    if (!account) return
    await navigator.clipboard.writeText(account.address)
    setCopiedEmail(true)
    toast.success('Correo copiado')
    setTimeout(() => setCopiedEmail(false), 1500)
  }, [account])

  // Auto-refresh on mount and when account changes
  useEffect(() => {
    if (account && !tokenExpired) {
      fetchMessages()
      if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current)
      refreshIntervalRef.current = setInterval(() => fetchMessages(), 5000)
    }
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current)
        refreshIntervalRef.current = null
      }
    }
  }, [account, tokenExpired, fetchMessages])

  // Message detail view
  if (selectedMsg) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSelectedMsg(null)}
            className="p-2 rounded-lg hover:bg-white/[0.06] transition-colors"
          >
            <ChevronDown className="w-4 h-4 text-white/50 theme-text-dim rotate-90" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{selectedMsg.subject}</p>
            <p className="text-xs text-white/40 theme-text-dim truncate">{selectedMsg.from}</p>
          </div>
        </div>

        <div
          className="bg-[#111113] theme-card rounded-xl border border-white/[0.06] p-4 prose prose-invert prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: selectedMsg.body }}
        />
      </div>
    )
  }

  // Show loading state while recovering
  if (isRecovering) {
    return (
      <div className="space-y-4">
        <div className="bg-[#111113] theme-card rounded-xl border border-white/[0.06] p-8 text-center">
          <Loader2 className="w-8 h-8 text-amber-500 animate-spin mx-auto" />
          <p className="text-xs text-white/40 theme-text-dim mt-3">Recuperando correo...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Email Address */}
      <div className="bg-[#111113] theme-card rounded-xl border border-white/[0.06] p-4 space-y-3">
        {account ? (
          <>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-white/50 theme-text-dim uppercase tracking-wider">Tu Correo Temporal</span>
              <button
                onClick={deleteAccount}
                className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-400/60 hover:text-red-400 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center gap-2.5 rounded-xl px-3.5 py-3 border border-white/[0.08]" style={{ background: 'var(--app-input)' }}>
              <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center shrink-0">
                <Mail className="w-4 h-4 text-amber-500" />
              </div>
              <p className="text-sm font-mono flex-1 truncate" style={{ color: 'var(--app-text-90)' }}>{account.address}</p>
              <button onClick={copyEmail} className="shrink-0 p-2 rounded-lg hover:bg-white/[0.06] transition-all duration-200 active:scale-95">
                {copiedEmail ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" style={{ color: 'var(--app-text-dim)' }} />}
              </button>
            </div>
            <button
              onClick={() => fetchMessages()}
              className="flex items-center gap-1.5 text-xs text-amber-500/70 hover:text-amber-500 transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              Actualizar bandeja
            </button>
            {tokenExpired && (
              <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 mt-2">
                <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                <span className="text-xs text-red-400">Token expirado — genera un nuevo correo</span>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="text-center py-8">
              <div className="relative w-16 h-16 mx-auto mb-4">
                <div className="absolute inset-0 bg-amber-500/10 rounded-2xl rotate-6" />
                <div className="relative w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/15 flex items-center justify-center">
                  <Mail className="w-7 h-7 text-amber-500/50" />
                </div>
              </div>
              <p className="text-sm font-medium mb-1" style={{ color: 'var(--app-text-70)' }}>Correo Temporal</p>
              <p className="text-xs mb-5 max-w-[220px] mx-auto" style={{ color: 'var(--app-text-dim)' }}>
                Genera un correo temporal para recibir mensajes
              </p>
              <button
                onClick={createEmail}
                disabled={isCreating}
                className="bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 disabled:opacity-50 text-black font-bold rounded-xl px-8 py-3 text-sm transition-all duration-300 flex items-center justify-center gap-2 mx-auto shadow-lg shadow-amber-500/20 active:scale-[0.98]"
              >
                {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {isCreating ? 'Creando...' : 'Generar Correo'}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Inbox */}
      {account && (
        <div className="space-y-2">
          <h3 className="text-xs font-medium text-white/50 theme-text-dim uppercase tracking-wider">
            Bandeja de Entrada ({messages.length})
          </h3>

          {messages.length === 0 ? (
            <div className="text-center py-8 bg-[#111113] theme-card rounded-xl border border-white/[0.06]">
              <p className="text-sm text-white/30 theme-text-dim">Sin mensajes aún</p>
              <p className="text-xs text-white/20 theme-text-faint mt-1">Los mensajes aparecerán aquí automáticamente</p>
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto space-y-1.5 custom-scrollbar">
              {messages.map((msg) => (
                <motion.button
                  key={msg.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  onClick={() => openMessage(msg)}
                  className="w-full text-left rounded-xl border border-white/[0.06] p-3.5 hover:border-amber-500/20 transition-all duration-200 group"
                  style={{ background: 'var(--app-card)' }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <div className="w-6 h-6 rounded-full bg-amber-500/15 flex items-center justify-center shrink-0">
                          <span className="text-[10px] font-bold text-amber-500">
                            {(msg.from?.name || msg.from?.address || 'D')[0].toUpperCase()}
                          </span>
                        </div>
                        <p className="text-xs font-medium truncate" style={{ color: 'var(--app-text-80)' }}>
                          {msg.from?.name || msg.from?.address || 'Desconocido'}
                        </p>
                      </div>
                      <p className="text-sm truncate pl-8" style={{ color: 'var(--app-text-60)' }}>{msg.subject || 'Sin asunto'}</p>
                      {msg.intro && <p className="text-xs truncate pl-8 mt-0.5" style={{ color: 'var(--app-text-dim)' }}>{msg.intro}</p>}
                    </div>
                    <span className="text-[10px] shrink-0 mt-0.5" style={{ color: 'var(--app-text-faint)' }}>
                      {new Date(msg.createdAt).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </motion.button>
              ))}
            </div>
          )}
        </div>
      )}

      {isLoadingMsg && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
        </div>
      )}
    </div>
  )
}

// ============================================================
// TAB 5: ADDRESS GENERATOR — Direct API (bypasses proxy)
// ============================================================

const ADDRESS_COUNTRIES = [
  { code: 'US', label: 'Estados Unidos', flag: '🇺🇸' },
  { code: 'GB', label: 'Reino Unido', flag: '🇬🇧' },
  { code: 'ES', label: 'España', flag: '🇪🇸' },
  { code: 'MX', label: 'México', flag: '🇲🇽' },
  { code: 'BR', label: 'Brasil', flag: '🇧🇷' },
  { code: 'FR', label: 'Francia', flag: '🇫🇷' },
  { code: 'DE', label: 'Alemania', flag: '🇩🇪' },
  { code: 'IT', label: 'Italia', flag: '🇮🇹' },
  { code: 'CA', label: 'Canadá', flag: '🇨🇦' },
  { code: 'AU', label: 'Australia', flag: '🇦🇺' },
  { code: 'IN', label: 'India', flag: '🇮🇳' },
  { code: 'NL', label: 'Países Bajos', flag: '🇳🇱' },
  { code: 'CH', label: 'Suiza', flag: '🇨🇭' },
  { code: 'IE', label: 'Irlanda', flag: '🇮🇪' },
  { code: 'DK', label: 'Dinamarca', flag: '🇩🇰' },
  { code: 'FI', label: 'Finlandia', flag: '🇫🇮' },
  { code: 'NO', label: 'Noruega', flag: '🇳🇴' },
  { code: 'NZ', label: 'Nueva Zelanda', flag: '🇳🇿' },
  { code: 'TR', label: 'Turquía', flag: '🇹🇷' },
  { code: 'IR', label: 'Irán', flag: '🇮🇷' },
  { code: 'RS', label: 'Serbia', flag: '🇷🇸' },
] as const

// All nat codes are directly from randomuser.me official documentation
// https://randomuser.me/documentation#nat
const NAT_MAP: Record<string, string> = {
  US: 'US', GB: 'GB', ES: 'ES', MX: 'MX', BR: 'BR',
  FR: 'FR', DE: 'DE', IT: 'IT', CA: 'CA', AU: 'AU',
  IN: 'IN', NL: 'NL', CH: 'CH', IE: 'IE', DK: 'DK',
  FI: 'FI', NO: 'NO', NZ: 'NZ', TR: 'TR', IR: 'IR', RS: 'RS',
}

function AddressTab() {
  const [selectedCountry, setSelectedCountry] = useState('US')
  const [quantity, setQuantity] = useState('5')
  const [addresses, setAddresses] = useState<GeneratedAddress[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)
  const [copiedAll, setCopiedAll] = useState(false)

  const handleGenerate = useCallback(async () => {
    setIsGenerating(true)
    setAddresses([])

    const qty = Math.min(Math.max(parseInt(quantity) || 1, 1), 50)
    const natCode = NAT_MAP[selectedCountry] || 'US'

    try {
      // ── DIRECT to randomuser.me API (CORS-enabled, no proxy needed) ──
      const res = await fetch(`https://randomuser.me/api/?results=${qty}&nat=${natCode}&inc=location,phone`)
      const data = await res.json()

      if (data.error) {
        toast.error('Error al generar direcciones. Intenta de nuevo.')
        return
      }

      const results: GeneratedAddress[] = (data.results || []).map((user: Record<string, unknown>) => {
        const loc = user.location as Record<string, unknown>
        const street = loc?.street as Record<string, unknown> | undefined
        const streetNum = street?.number ?? ''
        const streetName = street?.name ?? ''
        const phone = (user.phone as string) || ''

        return {
          street: `${streetNum} ${streetName}`.trim(),
          city: (loc?.city as string) || '',
          state: (loc?.state as string) || '',
          country: (loc?.country as string) || '',
          postcode: String(loc?.postcode ?? ''),
          phone: phone.replace(/\s/g, ''),
        }
      })

      setAddresses(results)
      toast.success(`${results.length} dirección${results.length > 1 ? 'es' : ''} generada${results.length > 1 ? 's' : ''}`)
    } catch {
      toast.error('Error de conexión. Verifica tu internet.')
    } finally {
      setIsGenerating(false)
    }
  }, [selectedCountry, quantity])

  const copyAddress = useCallback(async (addr: GeneratedAddress, idx: number) => {
    const text = `${addr.street}\n${addr.city}, ${addr.state} ${addr.postcode}\n${addr.country}\nTel: ${addr.phone}`
    await navigator.clipboard.writeText(text)
    setCopiedIdx(idx)
    toast.success('Dirección copiada')
    setTimeout(() => setCopiedIdx(null), 1500)
  }, [])

  const copyAll = useCallback(async () => {
    if (addresses.length === 0) return
    const text = addresses.map(a =>
      `${a.street} | ${a.city} | ${a.state} | ${a.postcode} | ${a.country} | ${a.phone}`
    ).join('\n')
    await navigator.clipboard.writeText(text)
    setCopiedAll(true)
    toast.success(`${addresses.length} direcciones copiadas`)
    setTimeout(() => setCopiedAll(false), 2000)
  }, [addresses])

  return (
    <div className="space-y-4">
      {/* Country & Quantity Selector */}
      <div className="bg-[#111113] theme-card rounded-xl border border-white/[0.06] p-4 space-y-3">
        <label className="text-xs font-medium text-white/50 theme-text-dim uppercase tracking-wider">País</label>
        <select
          value={selectedCountry}
          onChange={(e) => setSelectedCountry(e.target.value)}
          className="w-full bg-[#09090b] theme-input border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white theme-text focus:outline-none focus:border-amber-500/50 transition-colors"
        >
          {ADDRESS_COUNTRIES.map(c => (
            <option key={c.code} value={c.code}>{c.flag} {c.label}</option>
          ))}
        </select>

        <div className="flex gap-2">
          <div className="flex-1">
            <label className="text-xs font-medium text-white/50 theme-text-dim uppercase tracking-wider">Cantidad</label>
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              min="1"
              max="50"
              placeholder="5"
              className="w-full bg-[#09090b] theme-input border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white theme-text placeholder-white/20 focus:outline-none focus:border-amber-500/50 font-mono transition-colors"
            />
          </div>
        </div>

        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="w-full bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 disabled:opacity-50 text-black font-bold rounded-xl py-3 text-sm transition-all duration-300 flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 active:scale-[0.98]"
        >
          {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
          {isGenerating ? 'Generando...' : 'Generar Direcciones'}
        </button>
      </div>

      {/* Results */}
      {addresses.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-white/40 theme-text-dim">{addresses.length} resultado{addresses.length > 1 ? 's' : ''}</span>
            <button
              onClick={copyAll}
              className="flex items-center gap-1.5 text-xs text-amber-500 hover:text-amber-400 transition-colors"
            >
              {copiedAll ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              Copiar Todo
            </button>
          </div>

          <div className="max-h-[60vh] overflow-y-auto space-y-2 custom-scrollbar">
            {addresses.map((addr, idx) => (
              <motion.div
                key={`addr-${idx}-${addr.street}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03, duration: 0.3 }}
                className="relative rounded-xl border border-white/[0.06] overflow-hidden group"
                style={{ background: 'linear-gradient(135deg, var(--app-card-gradient-from, #1a1a2e), var(--app-card-gradient-to, #111113))' }}
              >
                <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-amber-500/60" />
                <div className="p-3.5 pl-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-amber-500/70 shrink-0" />
                        <span className="text-xs uppercase tracking-wider font-medium truncate" style={{ color: 'var(--app-text-dim)' }}>
                          {addr.country}
                        </span>
                      </div>
                      <p className="text-sm leading-snug" style={{ color: 'var(--app-text-90)' }}>
                        {addr.street}
                      </p>
                      <p className="text-sm leading-snug" style={{ color: 'var(--app-text-70)' }}>
                        {addr.city}, {addr.state}
                      </p>
                      <div className="flex gap-4 text-xs font-mono" style={{ color: 'var(--app-text-dim)' }}>
                        <span>CP: {addr.postcode}</span>
                        <span>Tel: {addr.phone}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => copyAddress(addr, idx)}
                      className="p-2 rounded-lg hover:bg-white/[0.06] transition-all duration-200 active:scale-95 shrink-0 ml-2"
                    >
                      {copiedIdx === idx ? (
                        <Check className="w-4 h-4 text-green-500" />
                      ) : (
                        <Copy className="w-4 h-4 transition-colors duration-200" style={{ color: 'var(--app-text-dim)' }} />
                      )}
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================
// IBAN data (countries, generation logic, real bank codes) imported from @/lib/iban-data

// ============================================================
// TAB: IBAN GENERATOR
// ============================================================

function IbanTab() {
  const [selectedCountry, setSelectedCountry] = useState('ES')
  const [quantity, setQuantity] = useState('5')
  const [ibans, setIbans] = useState<{ iban: string; country: IbanCountry }[]>([])
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)
  const [copiedAll, setCopiedAll] = useState(false)

  const handleGenerate = useCallback(() => {
    const country = IBAN_COUNTRIES.find(c => c.code === selectedCountry)
    if (!country) {
      toast.error('Selecciona un país válido')
      return
    }
    const qty = Math.min(Math.max(parseInt(quantity) || 1, 1), 100)
    const generated: { iban: string; country: IbanCountry }[] = []
    for (let i = 0; i < qty; i++) {
      generated.push({ iban: generateIban(country), country })
    }
    setIbans(generated)
    toast.success(`${qty} IBAN${qty > 1 ? 's' : ''} generado${qty > 1 ? 's' : ''}`)
  }, [selectedCountry, quantity])

  const formatIbanLocal = (iban: string) => formatIban(iban)

  const copyIban = useCallback(async (iban: string, idx: number) => {
    await navigator.clipboard.writeText(iban)
    setCopiedIdx(idx)
    toast.success('IBAN copiado')
    setTimeout(() => setCopiedIdx(null), 1500)
  }, [])

  const copyAll = useCallback(async () => {
    if (ibans.length === 0) return
    const text = ibans.map(i => i.iban).join('\n')
    await navigator.clipboard.writeText(text)
    setCopiedAll(true)
    toast.success(`${ibans.length} IBANs copiados`)
    setTimeout(() => setCopiedAll(false), 2000)
  }, [ibans])

  return (
    <div className="space-y-4">
      {/* Country & Quantity Selector */}
      <div className="bg-[#111113] theme-card rounded-xl border border-white/[0.06] p-4 space-y-3">
        <label className="text-xs font-medium text-white/50 theme-text-dim uppercase tracking-wider">País</label>
        <select
          value={selectedCountry}
          onChange={(e) => setSelectedCountry(e.target.value)}
          className="w-full bg-[#09090b] theme-input border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white theme-text focus:outline-none focus:border-amber-500/50 transition-colors"
        >
          {IBAN_COUNTRIES.map(c => (
            <option key={c.code} value={c.code}>{c.flag} {c.label} ({c.length} caracteres)</option>
          ))}
        </select>

        <div className="flex gap-2">
          <div className="flex-1">
            <label className="text-xs font-medium text-white/50 theme-text-dim uppercase tracking-wider">Cantidad</label>
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              min="1"
              max="100"
              placeholder="5"
              className="w-full bg-[#09090b] theme-input border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white theme-text placeholder-white/20 focus:outline-none focus:border-amber-500/50 font-mono transition-colors"
            />
          </div>
        </div>

        <button
          onClick={handleGenerate}
          className="w-full bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-black font-bold rounded-xl py-3 text-sm transition-all duration-300 flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 active:scale-[0.98]"
        >
          <Landmark className="w-4 h-4" />
          Generar IBAN
        </button>
      </div>

      {/* Results */}
      {ibans.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-white/40 theme-text-dim">{ibans.length} resultado{ibans.length > 1 ? 's' : ''}</span>
            <button
              onClick={copyAll}
              className="flex items-center gap-1.5 text-xs text-amber-500 hover:text-amber-400 transition-colors"
            >
              {copiedAll ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              Copiar Todo
            </button>
          </div>

          <div className="max-h-[60vh] overflow-y-auto space-y-2 custom-scrollbar">
            {ibans.map((item, idx) => (
              <motion.div
                key={`iban-${idx}-${item.iban}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03, duration: 0.3 }}
                className="relative rounded-xl border border-white/[0.06] overflow-hidden group"
                style={{ background: 'linear-gradient(135deg, var(--app-card-gradient-from, #1a1a2e), var(--app-card-gradient-to, #111113))' }}
              >
                <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-amber-500/60" />
                <div className="p-3.5 pl-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{item.country.flag}</span>
                        <span className="text-xs uppercase tracking-wider font-medium truncate" style={{ color: 'var(--app-text-dim)' }}>
                          {item.country.label}
                        </span>
                        <span className="text-[10px] font-mono text-amber-500/50 bg-amber-500/10 px-1.5 py-0.5 rounded-md">
                          {item.iban.length} chars
                        </span>
                      </div>
                      <p className="text-sm font-mono leading-snug tracking-wide" style={{ color: 'var(--app-text-90)' }}>
                        {formatIbanLocal(item.iban)}
                      </p>
                      <div className="flex gap-3 text-xs font-mono" style={{ color: 'var(--app-text-dim)' }}>
                        <span>Código: <span className="text-amber-500/70">{item.iban.slice(0, 2)}</span></span>
                        <span>Check: <span className="text-amber-500/70">{item.iban.slice(2, 4)}</span></span>
                      </div>
                    </div>
                    <button
                      onClick={() => copyIban(item.iban, idx)}
                      className="p-2 rounded-lg hover:bg-white/[0.06] transition-all duration-200 active:scale-95 shrink-0"
                    >
                      {copiedIdx === idx ? (
                        <Check className="w-4 h-4 text-green-500" />
                      ) : (
                        <Copy className="w-4 h-4 transition-colors duration-200" style={{ color: 'var(--app-text-dim)' }} />
                      )}
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================
// TAB 6: SETTINGS
// ============================================================

function SettingsTab() {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      return document.documentElement.classList.contains('dark')
    }
    return true
  })
  const [showSharePanel, setShowSharePanel] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)

  const APK_URL = 'https://www.mediafire.com/file/2gsvk7962tqqonv/HJTools_X.apk/file'
  const SHARE_TEXT = 'Descarga HJTools X - La toolkit todo en uno'
  const SHARE_FULL = `${SHARE_TEXT}\n${APK_URL}`

  const handleShare = useCallback(async () => {
    // Try native share API first (works in Chrome, some WebViews)
    if (navigator.share) {
      try {
        await navigator.share({ title: 'HJTools X', text: SHARE_TEXT, url: APK_URL })
        return
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') return
        // Fall through to custom panel
      }
    }
    // Fallback: show custom share panel
    setShowSharePanel(true)
  }, [])

  const shareWhatsApp = useCallback(() => {
    window.open(`https://wa.me/?text=${encodeURIComponent(SHARE_FULL)}`, '_blank')
  }, [])

  const shareTelegram = useCallback(() => {
    window.open(`https://t.me/share/url?url=${encodeURIComponent(APK_URL)}&text=${encodeURIComponent(SHARE_TEXT)}`, '_blank')
  }, [])

  const copyLink = useCallback(async () => {
    await navigator.clipboard.writeText(SHARE_FULL)
    setCopiedLink(true)
    toast.success('Link copiado al portapapeles')
    setTimeout(() => setCopiedLink(false), 2000)
  }, [])

  const toggleTheme = useCallback(() => {
    const html = document.documentElement
    if (html.classList.contains('dark')) {
      html.classList.remove('dark')
      html.classList.add('light')
      setIsDark(false)
      localStorage.setItem('theme', 'light')
    } else {
      html.classList.remove('light')
      html.classList.add('dark')
      setIsDark(true)
      localStorage.setItem('theme', 'dark')
    }
  }, [])

  useEffect(() => {
    const saved = localStorage.getItem('theme')
    if (saved === 'light') {
      document.documentElement.classList.remove('dark')
      document.documentElement.classList.add('light')
      setIsDark(false)
    } else {
      document.documentElement.classList.add('dark')
      document.documentElement.classList.remove('light')
      setIsDark(true)
    }
  }, [])

  return (
    <div className="space-y-4">
      {/* App Info */}
      <div className="bg-[#111113] theme-card rounded-xl border border-white/[0.06] p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-4 overflow-hidden">
          <img src="/logo.svg" alt="HJTools X" className="w-12 h-12" />
        </div>
        <h2 className="text-lg font-bold">
          <span className="text-amber-500">HJTools</span> X
        </h2>
        <p className="text-xs text-white/40 theme-text-dim mt-1">v1.0</p>
        <p className="text-xs text-white/30 theme-text-dim mt-3 max-w-xs mx-auto">
          Plataforma de verificación y utilidades inteligentes
        </p>
      </div>

      {/* Theme Toggle */}
      <div className="bg-[#111113] theme-card rounded-xl border border-white/[0.06] p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isDark ? <Moon className="w-5 h-5 text-amber-500" /> : <Sun className="w-5 h-5 text-amber-500" />}
            <div>
              <p className="text-sm font-medium">Tema {isDark ? 'Oscuro' : 'Claro'}</p>
              <p className="text-xs text-white/40 theme-text-dim">Toca para cambiar a modo {isDark ? 'claro' : 'oscuro'}</p>
            </div>
          </div>
          <button
            onClick={toggleTheme}
            className={`relative w-11 h-6 rounded-full transition-colors ${
              isDark ? 'bg-amber-500' : 'bg-gray-300'
            }`}
          >
            <div
              className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200"
              style={{ transform: isDark ? 'translateX(22px)' : 'translateX(2px)' }}
            />
          </button>
        </div>
      </div>

      {/* Features */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { icon: CreditCard, label: 'Tarjetas', desc: 'Algoritmo Luhn', color: 'text-blue-400', bg: 'bg-blue-500/10' },
          { icon: Landmark, label: 'IBAN', desc: 'MOD-97 válido', color: 'text-purple-400', bg: 'bg-purple-500/10' },
          { icon: Search, label: 'CCS Checker', desc: 'Verificación real', color: 'text-green-400', bg: 'bg-green-500/10' },
          { icon: Tv, label: 'IPTV', desc: 'Checker + Player', color: 'text-red-400', bg: 'bg-red-500/10' },
          { icon: Mail, label: 'Correo', desc: 'Temporales', color: 'text-amber-400', bg: 'bg-amber-500/10' },
          { icon: MapPin, label: 'Direcciones', desc: 'Por país', color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
        ].map((feature, i) => (
          <div key={i} className="rounded-xl border border-white/[0.06] p-3 space-y-1.5 hover:border-white/[0.12] transition-colors" style={{ background: 'var(--app-card)' }}>
            <div className={`w-8 h-8 rounded-lg ${feature.bg} flex items-center justify-center`}>
              <feature.icon className={`w-4 h-4 ${feature.color}`} />
            </div>
            <p className="text-xs font-semibold" style={{ color: 'var(--app-text)' }}>{feature.label}</p>
            <p className="text-[10px]" style={{ color: 'var(--app-text-dim)' }}>{feature.desc}</p>
          </div>
        ))}
      </div>

      {/* About */}
      <div className="rounded-xl border border-white/[0.06] p-4 space-y-3" style={{ background: 'var(--app-card)' }}>
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4" style={{ color: 'var(--app-text-dim)' }} />
          <h3 className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--app-text-dim)' }}>Acerca de</h3>
        </div>
        <p className="text-xs leading-relaxed" style={{ color: 'var(--app-text-dim)' }}>
          HJTools X v1.0 — Plataforma con Generador de Tarjetas, CCS Checker, IPTV Checker, Correo Temporal, Generador de Direcciones y Generador de IBAN, diseñada para verificación y utilidades inteligentes en tiempo real.
        </p>
        <div className="flex items-center gap-2">
          <Zap className="w-3 h-3 text-amber-500/40" />
          <span className="text-xs" style={{ color: 'var(--app-text-faint)' }}>Hecho por HacheJota</span>
        </div>
        <div className="flex items-center gap-4 pt-2">
          <a
            href="https://wa.me/524437863111"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-xs text-green-400/70 hover:text-green-400 transition-colors"
          >
            <Phone className="w-3.5 h-3.5" />
            WhatsApp
          </a>
          <a
            href="https://t.me/HcheJotaA_Bot"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-xs text-sky-400/70 hover:text-sky-400 transition-colors"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            Telegram
          </a>
        </div>
      </div>

      {/* Share APK Button */}
      <button
        onClick={handleShare}
        className="relative w-full overflow-hidden flex items-center justify-center gap-2.5 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:via-amber-300 hover:to-amber-400 text-black font-bold rounded-xl py-4 text-sm transition-all duration-300 shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 hover:scale-[1.02] active:scale-[0.98]"
      >
        <Share2 className="w-5 h-5" />
        Compartir APK
        <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-[shimmer_3s_infinite]" />
      </button>

      {/* Share Panel Modal */}
      <AnimatePresence>
        {showSharePanel && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setShowSharePanel(false)}
          >
            <motion.div
              initial={{ y: 300, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 300, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="w-full max-w-lg rounded-t-2xl border-t border-white/[0.08] p-5 pb-8"
              style={{ background: 'var(--app-card, #111113)' }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Handle */}
              <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-5" />

              {/* Title */}
              <div className="text-center mb-5">
                <h3 className="text-lg font-bold text-white">Compartir HJTools X</h3>
                <p className="text-xs text-white/40 mt-1">Elige dónde compartir la app</p>
              </div>

              {/* Share Options */}
              <div className="space-y-3">
                {/* WhatsApp */}
                <button
                  onClick={shareWhatsApp}
                  className="w-full flex items-center gap-4 bg-[#25D366]/15 hover:bg-[#25D366]/25 border border-[#25D366]/20 rounded-xl px-4 py-3.5 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                >
                  <div className="w-11 h-11 rounded-xl bg-[#25D366]/20 flex items-center justify-center">
                    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="#25D366">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                  </div>
                  <div className="text-left flex-1">
                    <p className="text-sm font-semibold text-[#25D366]">WhatsApp</p>
                    <p className="text-xs text-white/40">Compartir por WhatsApp</p>
                  </div>
                  <ExternalLink className="w-4 h-4 text-white/20" />
                </button>

                {/* Telegram */}
                <button
                  onClick={shareTelegram}
                  className="w-full flex items-center gap-4 bg-[#26A5E4]/15 hover:bg-[#26A5E4]/25 border border-[#26A5E4]/20 rounded-xl px-4 py-3.5 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                >
                  <div className="w-11 h-11 rounded-xl bg-[#26A5E4]/20 flex items-center justify-center">
                    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="#26A5E4">
                      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                    </svg>
                  </div>
                  <div className="text-left flex-1">
                    <p className="text-sm font-semibold text-[#26A5E4]">Telegram</p>
                    <p className="text-xs text-white/40">Compartir por Telegram</p>
                  </div>
                  <ExternalLink className="w-4 h-4 text-white/20" />
                </button>

                {/* Copy Link */}
                <button
                  onClick={copyLink}
                  className="w-full flex items-center gap-4 bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] rounded-xl px-4 py-3.5 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                >
                  <div className="w-11 h-11 rounded-xl bg-white/[0.08] flex items-center justify-center">
                    {copiedLink ? (
                      <Check className="w-5 h-5 text-green-500" />
                    ) : (
                      <Copy className="w-5 h-5 text-white/60" />
                    )}
                  </div>
                  <div className="text-left flex-1">
                    <p className="text-sm font-semibold text-white/90">{copiedLink ? 'Copiado!' : 'Copiar Link'}</p>
                    <p className="text-xs text-white/40">Copiar al portapapeles</p>
                  </div>
                </button>
              </div>

              {/* Cancel */}
              <button
                onClick={() => setShowSharePanel(false)}
                className="w-full mt-4 py-3 rounded-xl text-sm text-white/50 hover:text-white/70 hover:bg-white/[0.04] transition-all"
              >
                Cancelar
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
