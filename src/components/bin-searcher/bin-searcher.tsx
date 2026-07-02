'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, ChevronRight, ArrowLeft, Copy, Check, Loader2,
  CreditCard, Building2, Globe, Filter, X, Database, Landmark
} from 'lucide-react'
import { toast } from 'sonner'
import { BIN_COUNTRIES, type BinCountry } from '@/lib/bin-country-data'

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

type Step = 'country' | 'bank' | 'bins'

const NETWORK_COLORS: Record<string, string> = {
  VISA: 'text-blue-400',
  MASTERCARD: 'text-orange-400',
  AMEX: 'text-green-400',
  DISCOVER: 'text-amber-400',
  MAESTRO: 'text-red-400',
  JCB: 'text-purple-400',
  UNIONPAY: 'text-pink-400',
  DCI: 'text-cyan-400',
}

const NETWORK_BG: Record<string, string> = {
  VISA: 'bg-blue-500/10',
  MASTERCARD: 'bg-orange-500/10',
  AMEX: 'bg-green-500/10',
  DISCOVER: 'bg-amber-500/10',
  MAESTRO: 'bg-red-500/10',
  JCB: 'bg-purple-500/10',
  UNIONPAY: 'bg-pink-500/10',
  DCI: 'bg-cyan-500/10',
}

function formatBin(bin: string): string {
  if (bin.length <= 6) return bin
  return bin.slice(0, 4) + ' ' + bin.slice(4, 8)
}

function getNetworkColor(network: string): string {
  return NETWORK_COLORS[network.toUpperCase()] || 'text-gray-400'
}

function getNetworkBg(network: string): string {
  return NETWORK_BG[network.toUpperCase()] || 'bg-gray-500/10'
}

export function BinSearcher() {
  const [step, setStep] = useState<Step>('country')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCountry, setSelectedCountry] = useState<BinCountry | null>(null)
  const [banks, setBanks] = useState<BankInfo[]>([])
  const [bins, setBins] = useState<BinEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [copiedAll, setCopiedAll] = useState(false)
  const [filterType, setFilterType] = useState<string>('all')
  const [filterNetwork, setFilterNetwork] = useState<string>('all')
  const [bankName, setBankName] = useState<string>('')
  const [bankSearchQuery, setBankSearchQuery] = useState('')
  const [binSearchQuery, setBinSearchQuery] = useState('')
  const abortRef = useRef<AbortController | null>(null)

  const filteredCountries = BIN_COUNTRIES.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.code.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const filteredBanks = banks.filter(b =>
    b.name.toLowerCase().includes(bankSearchQuery.toLowerCase())
  )

  // Extract unique networks and types from bins
  const availableNetworks = [...new Set(bins.map(b => b.network).filter(Boolean))].sort()
  const availableTypes = [...new Set(bins.map(b => b.type).filter(Boolean))].sort()

  const filteredBins = bins.filter(b => {
    if (filterNetwork !== 'all' && b.network !== filterNetwork) return false
    if (filterType !== 'all' && b.type !== filterType) return false
    if (binSearchQuery && !b.bin.includes(binSearchQuery)) return false
    return true
  })

  const fetchCountryData = useCallback(async (country: BinCountry) => {
    setLoading(true)
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch(`/api/bin-country?country=${country.slug}`, {
        signal: controller.signal,
      })
      const data = await res.json()

      if (!res.ok) throw new Error(data.error || 'Error fetching data')

      setSelectedCountry(country)
      setBanks(data.banks || [])
      setBins(data.bins || [])
      setBankName('')
      setStep('bank')
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      toast.error('Error al cargar datos del país')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchBankData = useCallback(async (bank: BankInfo) => {
    setLoading(true)
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch(`/api/bin-country?country=${selectedCountry?.slug}&bank=${bank.slug}`, {
        signal: controller.signal,
      })
      const data = await res.json()

      if (!res.ok) throw new Error(data.error || 'Error fetching data')

      setBins(data.bins || [])
      setBankName(data.bankName || bank.name)
      setFilterNetwork('all')
      setFilterType('all')
      setBinSearchQuery('')
      setStep('bins')
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      toast.error('Error al cargar datos del banco')
    } finally {
      setLoading(false)
    }
  }, [selectedCountry])

  const goBack = useCallback(() => {
    if (step === 'bins') setStep('bank')
    else if (step === 'bank') setStep('country')
  }, [step])

  const copyAllBins = useCallback(async () => {
    const text = filteredBins.map(b => b.bin).join('\n')
    await navigator.clipboard.writeText(text)
    setCopiedAll(true)
    toast.success(`${filteredBins.length} BINs copiados`)
    setTimeout(() => setCopiedAll(false), 1500)
  }, [filteredBins])

  // Cleanup on unmount
  useEffect(() => {
    return () => abortRef.current?.abort()
  }, [])

  return (
    <div className="space-y-4">
      {/* Step indicator */}
      <div className="flex items-center gap-2 px-1">
        {(['country', 'bank', 'bins'] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            {i > 0 && <ChevronRight className="w-3 h-3 shrink-0" style={{ color: 'var(--app-text-dim)' }} />}
            <button
              onClick={() => {
                if (s === 'country') { setStep('country'); setSelectedCountry(null); setBanks([]); setBins([]) }
                else if (s === 'bank' && selectedCountry) { setStep('bank'); setBins([]) }
                else if (s === 'bins') setStep('bins')
              }}
              className={`text-xs font-medium transition-colors ${
                step === s ? 'text-amber-500' : ''
              }`}
              style={step !== s ? { color: 'var(--app-text-dim)' } : undefined}
            >
              {s === 'country' ? 'País' : s === 'bank' ? 'Banco' : 'BINs'}
            </button>
          </div>
        ))}
      </div>

      {/* Back button for bank/bins step */}
      {(step === 'bank' || step === 'bins') && (
        <motion.button
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          onClick={goBack}
          className="flex items-center gap-2 text-xs font-medium transition-colors hover:text-amber-400"
          style={{ color: 'var(--app-text-dim)' }}
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Volver
        </motion.button>
      )}

      <AnimatePresence mode="wait">
        {/* STEP 1: Country Selection */}
        {step === 'country' && (
          <motion.div
            key="country"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="space-y-4"
          >
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--app-text-dim)' }} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar país..."
                className="w-full pl-10 pr-4 py-3 text-sm rounded-xl border transition-colors focus:outline-none"
                style={{
                  background: 'var(--app-input, #09090b)',
                  borderColor: 'var(--app-card-border, rgba(255,255,255,0.08))',
                  color: 'var(--app-text)',
                }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-md hover:bg-white/10"
                >
                  <X className="w-3.5 h-3.5" style={{ color: 'var(--app-text-dim)' }} />
                </button>
              )}
            </div>

            {/* Country list */}
            <div className="grid grid-cols-2 gap-2 max-h-[60vh] overflow-y-auto custom-scrollbar pb-2">
              {filteredCountries.map((country) => (
                <motion.button
                  key={country.code}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => fetchCountryData(country)}
                  className="relative flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all duration-200 hover:border-amber-500/30 active:scale-[0.97] overflow-hidden group"
                  style={{
                    background: 'linear-gradient(135deg, var(--app-card-gradient-from, #1a1a2e), var(--app-card-gradient-to, #111113))',
                    borderColor: 'var(--app-card-border, rgba(255,255,255,0.06))',
                  }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-amber-500/0 to-amber-500/0 group-hover:from-amber-500/5 group-hover:to-transparent transition-all duration-300" />
                  <span className="text-xl">{country.flag}</span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold truncate" style={{ color: 'var(--app-text)' }}>
                      {country.name}
                    </p>
                    <p className="text-[10px] font-mono" style={{ color: 'var(--app-text-dim)' }}>
                      {country.code}
                    </p>
                  </div>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}

        {/* STEP 2: Bank Selection */}
        {step === 'bank' && (
          <motion.div
            key="bank"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="space-y-4"
          >
            {/* Country info */}
            <div className="flex items-center gap-3 p-3 rounded-xl border"
              style={{
                background: 'linear-gradient(135deg, rgba(245,158,11,0.08), var(--app-card, #111113))',
                borderColor: 'rgba(245,158,11,0.15)',
              }}
            >
              <span className="text-2xl">{selectedCountry?.flag}</span>
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--app-text)' }}>
                  {selectedCountry?.name}
                </p>
                <p className="text-[11px]" style={{ color: 'var(--app-text-dim)' }}>
                  {bins.length} BINs disponibles · {banks.length} bancos
                </p>
              </div>
            </div>

            {/* Bank search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--app-text-dim)' }} />
              <input
                type="text"
                value={bankSearchQuery}
                onChange={(e) => setBankSearchQuery(e.target.value)}
                placeholder="Buscar banco..."
                className="w-full pl-10 pr-4 py-3 text-sm rounded-xl border transition-colors focus:outline-none"
                style={{
                  background: 'var(--app-input, #09090b)',
                  borderColor: 'var(--app-card-border, rgba(255,255,255,0.08))',
                  color: 'var(--app-text)',
                }}
              />
            </div>

            {/* Option: See all BINs without filter */}
            {bins.length > 0 && (
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => {
                  setBankName('Todos')
                  setFilterNetwork('all')
                  setFilterType('all')
                  setBinSearchQuery('')
                  setStep('bins')
                }}
                className="w-full flex items-center gap-3 p-3.5 rounded-xl border transition-all duration-200 hover:border-amber-500/30"
                style={{
                  background: 'linear-gradient(135deg, rgba(245,158,11,0.1), var(--app-card, #111113))',
                  borderColor: 'rgba(245,158,11,0.2)',
                }}
              >
                <div className="w-9 h-9 rounded-lg bg-amber-500/15 flex items-center justify-center">
                  <Database className="w-4 h-4 text-amber-400" />
                </div>
                <div className="text-left">
                  <p className="text-xs font-semibold text-amber-400">Ver todos los BINs</p>
                  <p className="text-[10px]" style={{ color: 'var(--app-text-dim)' }}>
                    {bins.length} BINs de {selectedCountry?.name}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 ml-auto text-amber-500/50" />
              </motion.button>
            )}

            {/* Bank list */}
            <div className="space-y-1.5 max-h-[50vh] overflow-y-auto custom-scrollbar pb-2">
              {filteredBanks
                .sort((a, b) => b.count - a.count)
                .map((bank, idx) => (
                <motion.button
                  key={bank.slug}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => fetchBankData(bank)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all duration-200 hover:border-white/[0.12] active:scale-[0.97]"
                  style={{
                    background: 'var(--app-card, #111113)',
                    borderColor: 'var(--app-card-border, rgba(255,255,255,0.06))',
                  }}
                >
                  <div className="w-9 h-9 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0">
                    <Building2 className="w-4 h-4 text-purple-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold truncate" style={{ color: 'var(--app-text)' }}>
                      {bank.name}
                    </p>
                    <p className="text-[10px]" style={{ color: 'var(--app-text-dim)' }}>
                      {bank.count} BINs
                    </p>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--app-text-dim)' }} />
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}

        {/* STEP 3: BIN List */}
        {step === 'bins' && (
          <motion.div
            key="bins"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="space-y-4"
          >
            {/* Header with country/bank info */}
            <div className="flex items-center gap-3 p-3 rounded-xl border"
              style={{
                background: 'linear-gradient(135deg, rgba(245,158,11,0.08), var(--app-card, #111113))',
                borderColor: 'rgba(245,158,11,0.15)',
              }}
            >
              <span className="text-2xl">{selectedCountry?.flag}</span>
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color: 'var(--app-text)' }}>
                  {bankName || selectedCountry?.name}
                </p>
                <p className="text-[11px]" style={{ color: 'var(--app-text-dim)' }}>
                  {filteredBins.length} de {bins.length} BINs
                </p>
              </div>
            </div>

            {/* Filters */}
            {(availableNetworks.length > 1 || availableTypes.length > 1) && (
              <div className="flex gap-2 flex-wrap">
                {availableNetworks.length > 1 && (
                  <select
                    value={filterNetwork}
                    onChange={(e) => setFilterNetwork(e.target.value)}
                    className="flex-1 min-w-0 px-3 py-2 text-xs rounded-lg border transition-colors focus:outline-none"
                    style={{
                      background: 'var(--app-input, #09090b)',
                      borderColor: 'var(--app-card-border, rgba(255,255,255,0.08))',
                      color: 'var(--app-text)',
                    }}
                  >
                    <option value="all">Todas las redes</option>
                    {availableNetworks.map(n => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                )}
                {availableTypes.length > 1 && (
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="flex-1 min-w-0 px-3 py-2 text-xs rounded-lg border transition-colors focus:outline-none"
                    style={{
                      background: 'var(--app-input, #09090b)',
                      borderColor: 'var(--app-card-border, rgba(255,255,255,0.08))',
                      color: 'var(--app-text)',
                    }}
                  >
                    <option value="all">Todos los tipos</option>
                    {availableTypes.map(t => (
                      <option key={t} value={t}>{t.toUpperCase()}</option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {/* BIN search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--app-text-dim)' }} />
              <input
                type="text"
                inputMode="numeric"
                value={binSearchQuery}
                onChange={(e) => setBinSearchQuery(e.target.value)}
                placeholder="Buscar BIN..."
                className="w-full pl-10 pr-4 py-2.5 text-xs font-mono rounded-lg border transition-colors focus:outline-none"
                style={{
                  background: 'var(--app-input, #09090b)',
                  borderColor: 'var(--app-card-border, rgba(255,255,255,0.08))',
                  color: 'var(--app-text)',
                }}
              />
            </div>

            {/* Copy all */}
            {filteredBins.length > 0 && (
              <button
                onClick={copyAllBins}
                className="w-full flex items-center justify-center gap-2 text-xs font-medium text-amber-500 hover:text-amber-400 py-2 transition-colors"
              >
                {copiedAll ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedAll ? `Copiados ${filteredBins.length} BINs` : `Copiar ${filteredBins.length} BINs`}
              </button>
            )}

            {/* BIN list */}
            <div className="space-y-1.5 max-h-[55vh] overflow-y-auto custom-scrollbar pb-2">
              {filteredBins.length === 0 ? (
                <div className="text-center py-8">
                  <CreditCard className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-xs" style={{ color: 'var(--app-text-dim)' }}>
                    No se encontraron BINs
                  </p>
                </div>
              ) : (
                filteredBins.map((entry, idx) => (
                  <motion.div
                    key={entry.bin}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(idx * 0.015, 0.5), duration: 0.25 }}
                    className="relative flex items-center gap-3 p-3 rounded-xl border overflow-hidden group transition-all duration-200 hover:border-white/[0.12]"
                    style={{
                      background: 'var(--app-card, #111113)',
                      borderColor: 'var(--app-card-border, rgba(255,255,255,0.06))',
                    }}
                  >
                    {/* Left accent line */}
                    <div className={`absolute left-0 top-0 bottom-0 w-0.5 ${getNetworkBg(entry.network)}`} />

                    {/* BIN number + badges */}
                    <div className="pl-2 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-mono font-bold tracking-wider" style={{ color: 'var(--app-text)' }}>
                          {formatBin(entry.bin)}
                        </span>
                        {/* Network badge */}
                        {entry.network && (
                          <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md ${getNetworkBg(entry.network)} ${getNetworkColor(entry.network)}`}>
                            {entry.network}
                          </span>
                        )}
                        {/* Type badge */}
                        {entry.type && (
                          <span className="text-[9px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-white/[0.05] text-white/50">
                            {entry.type}
                          </span>
                        )}
                        {/* Level badge */}
                        {entry.level && (
                          <span className="text-[9px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-500/60">
                            {entry.level}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Bank name */}
                    {bankName && bankName !== 'Todos' && (
                      <div className="flex items-center gap-1.5 shrink-0 pr-1">
                        <Landmark className="w-3 h-3 text-purple-400/60" />
                        <span className="text-[10px] font-medium text-purple-400/70 max-w-[100px] truncate">
                          {bankName}
                        </span>
                      </div>
                    )}
                  </motion.div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading overlay */}
      <AnimatePresence>
        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center rounded-2xl"
            style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
          >
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-6 h-6 text-amber-500 animate-spin" />
              <p className="text-xs font-medium" style={{ color: 'var(--app-text)' }}>
                Cargando...
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
