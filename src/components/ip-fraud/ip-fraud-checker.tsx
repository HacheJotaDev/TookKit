'use client'

import { useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Shield, ShieldAlert, ShieldCheck, ShieldOff,
  Globe, MapPin, Building2, Server, Wifi,
  Copy, Check, Loader2, RefreshCw, AlertTriangle
} from 'lucide-react'
import { toast } from 'sonner'
import { useT } from '@/lib/i18n'

// ============================================================
// TYPES
// ============================================================

interface IpFraudData {
  ip: string
  score: number
  risk: 'low' | 'medium' | 'high' | 'unknown'
  operator: {
    ispName?: string
    orgName?: string
    connectionType?: string
  }
  location: {
    countryName?: string
    countryCode?: string
    state?: string
    district?: string
    city?: string
    postalCode?: string
  }
  proxies: Record<string, string>
}

// ============================================================
// PROXY KEY → SHARED I18N KEY MAPPING
// ============================================================

const PROXY_KEY_MAP: Record<string, string> = {
  anonymizing_vpn: 'ipfraud.proxy_vpn',
  tor_exit_node: 'ipfraud.proxy_tor',
  server: 'ipfraud.proxy_server',
  public_proxy: 'ipfraud.proxy_public',
  search_engine_robot: 'ipfraud.proxy_bot',
  blacklisted: 'ipfraud.proxy_blacklisted',
}

// ============================================================
// CONSTANTS (visual-only, no text)
// ============================================================

const RISK_STYLES = {
  low:    { color: 'text-emerald-400', bg: 'bg-emerald-500/15', border: 'border-emerald-500/30', gradient: 'from-emerald-600 to-green-500' },
  medium: { color: 'text-amber-400',   bg: 'bg-amber-500/15',   border: 'border-amber-500/30',   gradient: 'from-amber-500 to-yellow-500' },
  high:   { color: 'text-red-400',     bg: 'bg-red-500/15',     border: 'border-red-500/30',     gradient: 'from-red-600 to-rose-500' },
  unknown:{ color: 'text-gray-400',    bg: 'bg-gray-500/15',    border: 'border-gray-500/30',    gradient: 'from-gray-600 to-gray-500' },
} as const

const RISK_LABEL_KEY: Record<string, string> = {
  low: 'ipfraud.riskLow', medium: 'ipfraud.riskMedium', high: 'ipfraud.riskHigh', unknown: 'ipfraud.riskUnknown',
}

function isNo(value: string): boolean {
  const v = value.toLowerCase().trim()
  return v === 'no' || v === ''
}

function getRiskIcon(risk: string) {
  switch (risk) {
    case 'low': return <ShieldCheck className="w-5 h-5 text-emerald-400" />
    case 'medium': return <ShieldAlert className="w-5 h-5 text-amber-400" />
    case 'high': return <ShieldOff className="w-5 h-5 text-red-400" />
    default: return <Shield className="w-5 h-5 text-gray-400" />
  }
}

// ============================================================
// SUB-COMPONENTS (receive text via props)
// ============================================================

function ScoreGauge({ score, safeLabel, riskLabel }: { score: number; safeLabel: string; riskLabel: string }) {
  const riskKey = score <= 25 ? 'low' : score <= 60 ? 'medium' : 'high'
  const style = RISK_STYLES[riskKey]
  const pct = Math.min(100, Math.max(0, score))

  return (
    <div className="w-full">
      <div className="flex items-center justify-center gap-2 mb-3">
        <span className={`text-5xl font-bold tabular-nums ${style.color}`}>{score}</span>
        <span className="text-sm opacity-50">/ 100</span>
      </div>
      <div className="relative h-3 rounded-full bg-white/5 overflow-hidden">
        <motion.div
          className={`absolute inset-y-0 left-0 rounded-full bg-gradient-to-r ${style.gradient}`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1, ease: 'easeOut', delay: 0.2 }}
        />
      </div>
      <div className="flex justify-between mt-1.5">
        <span className="text-[10px] opacity-30">0 - {safeLabel}</span>
        <span className="text-[10px] opacity-30">100 - {riskLabel}</span>
      </div>
    </div>
  )
}

function CheckRow({ label, value, detectedLabel, noLabel }: { label: string; value: string; detectedLabel: string; noLabel: string }) {
  const isDetected = !isNo(value)
  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-white/[0.02]">
      <span className="text-sm opacity-70">{label}</span>
      {isDetected ? (
        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/20">{detectedLabel}</span>
      ) : (
        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">{noLabel}</span>
      )}
    </div>
  )
}

function InfoRow({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  if (!value) return null
  return (
    <div className="flex items-start gap-3 py-2">
      {icon && <div className="mt-0.5 opacity-40">{icon}</div>}
      <div className="min-w-0">
        <span className="text-xs opacity-40 block">{label}</span>
        <span className="text-sm font-medium">{value}</span>
      </div>
    </div>
  )
}

function SectionCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-white/[0.06] overflow-hidden"
    >
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/[0.04] bg-white/[0.02]">
        {icon}
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <div className="p-4 space-y-1">{children}</div>
    </motion.div>
  )
}

// ============================================================
// CLIENT-SIDE CACHE (module level — persists across re-renders)
// ============================================================

const clientCache = new Map<string, { data: IpFraudData; timestamp: number }>()
const CLIENT_CACHE_TTL = 30 * 60 * 1000

function getClientCached(ip: string): IpFraudData | null {
  const entry = clientCache.get(ip)
  if (entry && Date.now() - entry.timestamp < CLIENT_CACHE_TTL) return entry.data
  if (entry) clientCache.delete(ip)
  return null
}

function setClientCache(ip: string, data: IpFraudData) {
  clientCache.set(ip, { data, timestamp: Date.now() })
  if (clientCache.size > 100) {
    const oldest = Array.from(clientCache.keys())[0]
    clientCache.delete(oldest)
  }
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export function IpFraudChecker() {
  const { t } = useT()

  const [userIp, setUserIp] = useState<string>('')
  const [inputIp, setInputIp] = useState('')
  const [data, setData] = useState<IpFraudData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchIp = async () => {
      try {
        const res = await fetch('https://api.ipify.org?format=json', { signal: AbortSignal.timeout(5000) })
        if (res.ok) {
          const json = await res.json()
          const ip = json.ip as string
          setUserIp(ip)
          setInputIp(ip)
        }
      } catch { /* user can type IP manually */ }
    }
    fetchIp()
  }, [])

  const checkIp = useCallback(async (ip: string) => {
    if (!ip || !/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) return
    setIsLoading(true)
    setError('')
    setData(null)

    const cached = getClientCached(ip)
    if (cached) { setData(cached); return }

    try {
      const res = await fetch(`/api/ip-fraud?ip=${encodeURIComponent(ip)}`, { signal: AbortSignal.timeout(15000) })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: t('ipfraud.errorFetch') }))
        setError(err.error || t('ipfraud.errorFetch'))
        return
      }
      const result = await res.json() as IpFraudData
      setData(result)
      setClientCache(ip, result)
    } catch {
      setError(t('ipfraud.errorFetch'))
    } finally {
      setIsLoading(false)
    }
  }, [t])

  const handleCheck = useCallback(() => {
    const ip = inputIp.trim()
    if (ip) checkIp(ip)
  }, [inputIp, checkIp])

  const handleCopy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      toast.success(t('ipfraud.copied'))
      setTimeout(() => setCopied(false), 2000)
    } catch { toast.error('Error') }
  }, [t])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleCheck()
  }, [handleCheck])

  const riskStyle = data ? RISK_STYLES[data.risk as keyof typeof RISK_STYLES] || RISK_STYLES.unknown : RISK_STYLES.unknown

  return (
    <div className="space-y-4 px-1">
      {/* Header */}
      <div className="text-center space-y-1">
        <h2 className="text-lg font-bold flex items-center justify-center gap-2">
          <Shield className="w-5 h-5 text-rose-400" />
          {t('ipfraud.title')}
        </h2>
        <p className="text-xs opacity-40">{t('ipfraud.subtitle')}</p>
      </div>

      {/* IP Input */}
      <div className="relative">
        <input
          type="text"
          value={inputIp}
          onChange={(e) => setInputIp(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={userIp || '0.0.0.0'}
          disabled={isLoading}
          className="w-full px-4 py-3.5 rounded-xl border border-white/[0.08] bg-white/[0.03] text-sm placeholder:opacity-25 focus:outline-none focus:border-rose-500/40 focus:ring-1 focus:ring-rose-500/20 transition-all disabled:opacity-50"
          style={{ color: 'var(--app-text)' }}
        />
        <button
          onClick={() => inputIp && handleCopy(inputIp)}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg hover:bg-white/[0.05] transition-colors"
          title="Copy IP"
        >
          {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 opacity-40" />}
        </button>
      </div>

      {/* Check Button */}
      <motion.button
        onClick={handleCheck}
        disabled={isLoading || !inputIp.trim()}
        className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-rose-500/10"
        whileTap={{ scale: 0.98 }}
      >
        {isLoading ? (
          <><Loader2 className="w-4 h-4 animate-spin" />{t('ipfraud.analyzing')}</>
        ) : data ? (
          <><RefreshCw className="w-4 h-4" />{t('ipfraud.refreshBtn')}</>
        ) : (
          <><Shield className="w-4 h-4" />{t('ipfraud.checkBtn')}</>
        )}
      </motion.button>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm"
          >
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results */}
      <AnimatePresence>
        {data && (
          <motion.div
            key={data.ip}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="space-y-3"
          >
            {/* IP + Risk Badge */}
            <div className="flex items-center justify-between px-1">
              <span className="text-lg font-bold font-mono">{data.ip}</span>
              <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border ${riskStyle.bg} ${riskStyle.border}`}>
                {getRiskIcon(data.risk)}
                <span className={`text-xs font-semibold ${riskStyle.color}`}>
                  {t(RISK_LABEL_KEY[data.risk] || 'ipfraud.riskUnknown')}
                </span>
              </div>
            </div>

            {/* Score Gauge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
              className="rounded-xl border border-white/[0.06] p-5 bg-white/[0.02]"
            >
              <ScoreGauge score={data.score} safeLabel={t('ipfraud.safe')} riskLabel={t('ipfraud.riskLabel')} />
            </motion.div>

            {/* Operator */}
            <SectionCard title={t('ipfraud.operator')} icon={<Building2 className="w-4 h-4 opacity-50" />}>
              <InfoRow label={t('ipfraud.isp')} value={data.operator.ispName} icon={<Server className="w-3.5 h-3.5" />} />
              <InfoRow label={t('ipfraud.org')} value={data.operator.orgName} icon={<Building2 className="w-3.5 h-3.5" />} />
              <InfoRow label={t('ipfraud.connectionType')} value={data.operator.connectionType} />
            </SectionCard>

            {/* Location */}
            <SectionCard title={t('ipfraud.location')} icon={<MapPin className="w-4 h-4 opacity-50" />}>
              <InfoRow label={t('ipfraud.countryLabel')} value={data.location.countryName} icon={<Globe className="w-3.5 h-3.5" />} />
              <InfoRow label={t('ipfraud.city')} value={data.location.city} icon={<MapPin className="w-3.5 h-3.5" />} />
              <InfoRow label={t('ipfraud.state')} value={data.location.state} />
              <InfoRow label={t('ipfraud.district')} value={data.location.district} />
              <InfoRow label={t('ipfraud.postalCode')} value={data.location.postalCode} />
            </SectionCard>

            {/* Proxies & VPN */}
            <SectionCard title={t('ipfraud.proxies')} icon={<Wifi className="w-4 h-4 opacity-50" />}>
              {Object.entries(data.proxies).map(([key, value]) => (
                <CheckRow
                  key={key}
                  label={t(PROXY_KEY_MAP[key] || key)}
                  value={value}
                  detectedLabel={t('ipfraud.detected')}
                  noLabel={t('ipfraud.no')}
                />
              ))}
            </SectionCard>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty state */}
      {!data && !isLoading && !error && (
        <div className="text-center py-12 opacity-30">
          <Shield className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="text-sm">{t('ipfraud.yourIp')}</p>
          <p className="text-xs mt-1 opacity-50">{userIp || '...'}</p>
        </div>
      )}
    </div>
  )
}
