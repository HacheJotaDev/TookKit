'use client'

import { useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Shield, ShieldAlert, ShieldCheck, ShieldOff,
  Globe, MapPin, Building2, Server, Wifi,
  Copy, Check, Loader2, RefreshCw, ExternalLink, AlertTriangle
} from 'lucide-react'
import { toast } from 'sonner'

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
    countryFlag?: string
    countryEmoji?: string
    state?: string
    district?: string
    city?: string
    postalCode?: string
    latitude?: string
    longitude?: string
    timezone?: string
    currency?: string
  }
  datacenter: string
  proxies: Record<string, string>
  residentialProxy: string
}

// ============================================================
// CONSTANTS
// ============================================================

const RISK_CONFIG = {
  low: { color: 'text-emerald-400', bg: 'bg-emerald-500/15', border: 'border-emerald-500/30', label: 'Bajo Riesgo', gradient: 'from-emerald-600 to-green-500' },
  medium: { color: 'text-amber-400', bg: 'bg-amber-500/15', border: 'border-amber-500/30', label: 'Riesgo Medio', gradient: 'from-amber-500 to-yellow-500' },
  high: { color: 'text-red-400', bg: 'bg-red-500/15', border: 'border-red-500/30', label: 'Alto Riesgo', gradient: 'from-red-600 to-rose-500' },
  unknown: { color: 'text-gray-400', bg: 'bg-gray-500/15', border: 'border-gray-500/30', label: 'Desconocido', gradient: 'from-gray-600 to-gray-500' },
} as const

const RISK_CONFIG_EN = {
  low: { ...RISK_CONFIG.low, label: 'Low Risk' },
  medium: { ...RISK_CONFIG.medium, label: 'Medium Risk' },
  high: { ...RISK_CONFIG.high, label: 'High Risk' },
  unknown: { ...RISK_CONFIG.unknown, label: 'Unknown' },
} as const

const RISK_CONFIG_PT = {
  low: { ...RISK_CONFIG.low, label: 'Baixo Risco' },
  medium: { ...RISK_CONFIG.medium, label: 'Risco Médio' },
  high: { ...RISK_CONFIG.high, label: 'Alto Risco' },
  unknown: { ...RISK_CONFIG.unknown, label: 'Desconhecido' },
} as const

const PROXY_LABELS: Record<string, Record<string, string>> = {
  es: {
    anonymizing_vpn: 'VPN Anonimizadora',
    tor_exit_node: 'Nodo de Salida Tor',
    server: 'Servidor',
    public_proxy: 'Proxy Público',
    web_proxy: 'Proxy Web',
    search_engine_robot: 'Robot de Motor de Búsqueda',
    residential_proxy: 'Proxy Residencial',
  },
  en: {
    anonymizing_vpn: 'Anonymizing VPN',
    tor_exit_node: 'Tor Exit Node',
    server: 'Server',
    public_proxy: 'Public Proxy',
    web_proxy: 'Web Proxy',
    search_engine_robot: 'Search Engine Robot',
    residential_proxy: 'Residential Proxy',
  },
  pt: {
    anonymizing_vpn: 'VPN Anonimizada',
    tor_exit_node: 'Nó de Saída Tor',
    server: 'Servidor',
    public_proxy: 'Proxy Público',
    web_proxy: 'Proxy Web',
    search_engine_robot: 'Robô de Mecanismo de Busca',
    residential_proxy: 'Proxy Residencial',
  },
}

const OPERATOR_LABELS: Record<string, Record<string, string>> = {
  es: { ispName: 'ISP', orgName: 'Organización', connectionType: 'Tipo de Conexión' },
  en: { ispName: 'ISP', orgName: 'Organization', connectionType: 'Connection Type' },
  pt: { ispName: 'ISP', orgName: 'Organização', connectionType: 'Tipo de Conexão' },
}

const LOCATION_LABELS: Record<string, Record<string, string>> = {
  es: { countryName: 'País', state: 'Estado / Provincia', district: 'Distrito', city: 'Ciudad', postalCode: 'Código Postal', timezone: 'Zona Horaria', currency: 'Moneda' },
  en: { countryName: 'Country', state: 'State / Province', district: 'District', city: 'City', postalCode: 'Postal Code', timezone: 'Timezone', currency: 'Currency' },
  pt: { countryName: 'País', state: 'Estado / Província', district: 'Distrito', city: 'Cidade', postalCode: 'Código Postal', timezone: 'Fuso Horário', currency: 'Moeda' },
}

const UI_TEXT = {
  es: {
    title: 'IP Fraude',
    subtitle: 'Analiza el riesgo de fraude de una IP',
    yourIp: 'Tu IP detectada',
    analyzing: 'Analizando IP...',
    checkBtn: 'Analizar IP',
    refreshBtn: 'Analizar de nuevo',
    errorFetch: 'Error al analizar la IP. Intenta de nuevo.',
    copied: 'IP copiada',
    scoreOf: 'de 100',
    operator: 'Operador',
    location: 'Ubicación',
    proxies: 'Proxies & VPN',
    datacenter: 'Datacenter',
    no: 'No',
    yes: 'Sí',
    unknown: 'Desconocido',
    notDetected: 'No detectado',
  },
  en: {
    title: 'IP Fraud',
    subtitle: 'Analyze the fraud risk of an IP',
    yourIp: 'Your detected IP',
    analyzing: 'Analyzing IP...',
    checkBtn: 'Analyze IP',
    refreshBtn: 'Analyze again',
    errorFetch: 'Error analyzing IP. Try again.',
    copied: 'IP copied',
    scoreOf: 'of 100',
    operator: 'Operator',
    location: 'Location',
    proxies: 'Proxies & VPN',
    datacenter: 'Datacenter',
    description: 'Description',
    no: 'No',
    yes: 'Yes',
    unknown: 'Unknown',
    notDetected: 'Not detected',
  },
  pt: {
    title: 'IP Fraude',
    subtitle: 'Analise o risco de fraude de um IP',
    yourIp: 'Seu IP detectado',
    analyzing: 'Analisando IP...',
    checkBtn: 'Analisar IP',
    refreshBtn: 'Analisar novamente',
    errorFetch: 'Erro ao analisar o IP. Tente novamente.',
    copied: 'IP copiado',
    scoreOf: 'de 100',
    operator: 'Operador',
    location: 'Localização',
    proxies: 'Proxies & VPN',
    datacenter: 'Datacenter',
    description: 'Descrição',
    no: 'Não',
    yes: 'Sim',
    unknown: 'Desconhecido',
    notDetected: 'Não detectado',
  },
} as const

// ============================================================
// HELPERS
// ============================================================

function getLang(): 'es' | 'en' | 'pt' {
  if (typeof navigator === 'undefined') return 'es'
  const lang = navigator.language.toLowerCase()
  if (lang.startsWith('pt')) return 'pt'
  if (lang.startsWith('en')) return 'en'
  return 'es'
}

function getRiskConfig(risk: string) {
  const lang = getLang()
  const configs = lang === 'en' ? RISK_CONFIG_EN : lang === 'pt' ? RISK_CONFIG_PT : RISK_CONFIG
  return configs[risk as keyof typeof configs] || configs.unknown
}

function isNo(value: string): boolean {
  const v = value.toLowerCase().trim()
  return v === 'no' || v === '' || v === 'unknown' || v === 'desconocido'
}

function getRiskIcon(risk: string) {
  switch (risk) {
    case 'low': return <ShieldCheck className="w-5 h-5 text-emerald-400" />
    case 'medium': return <ShieldAlert className="w-5 h-5 text-amber-400" />
    case 'high': return <ShieldOff className="w-5 h-5 text-red-400" />
    default: return <Shield className="w-5 h-5 text-gray-400" />
  }
}

function ScoreGauge({ score }: { score: number }) {
  const riskKey = score <= 25 ? 'low' : score <= 60 ? 'medium' : 'high'
  const config = RISK_CONFIG[riskKey]
  const pct = Math.min(100, Math.max(0, score))

  return (
    <div className="w-full">
      {/* Score number */}
      <div className="flex items-center justify-center gap-2 mb-3">
        <span className={`text-5xl font-bold tabular-nums ${config.color}`}>{score}</span>
        <span className="text-sm opacity-50">/ 100</span>
      </div>

      {/* Bar */}
      <div className="relative h-3 rounded-full bg-white/5 overflow-hidden">
        <motion.div
          className={`absolute inset-y-0 left-0 rounded-full bg-gradient-to-r ${config.gradient}`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1, ease: 'easeOut', delay: 0.2 }}
        />
      </div>

      {/* Labels */}
      <div className="flex justify-between mt-1.5">
        <span className="text-[10px] opacity-30">0 - Seguro</span>
        <span className="text-[10px] opacity-30">100 - Riesgo</span>
      </div>
    </div>
  )
}

function CheckRow({ label, value }: { label: string; value: string }) {
  const isDetected = !isNo(value)
  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-white/[0.02]">
      <span className="text-sm opacity-70">{label}</span>
      {isDetected ? (
        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/20">Detectado</span>
      ) : (
        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">No</span>
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
const CLIENT_CACHE_TTL = 30 * 60 * 1000 // 30 min

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
  const lang = getLang()
  const t = UI_TEXT[lang]

  const [userIp, setUserIp] = useState<string>('')
  const [inputIp, setInputIp] = useState('')
  const [data, setData] = useState<IpFraudData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')

  // Fetch user's IP on mount
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
      } catch {
        // Silently fail — user can type IP manually
      }
    }
    fetchIp()
  }, [])

  const checkIp = useCallback(async (ip: string) => {
    if (!ip || !/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) return
    setIsLoading(true)
    setError('')
    setData(null)

    // Check client cache first — avoids Vercel invocation entirely
    const cached = getClientCached(ip)
    if (cached) {
      setData(cached)
      return
    }

    try {
      const res = await fetch(`/api/ip-fraud?ip=${encodeURIComponent(ip)}`, {
        signal: AbortSignal.timeout(15000),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: t.errorFetch }))
        setError(err.error || t.errorFetch)
        return
      }
      const result = await res.json() as IpFraudData
      setData(result)
      setClientCache(ip, result)
    } catch {
      setError(t.errorFetch)
    } finally {
      setIsLoading(false)
    }
  }, [t.errorFetch])

  const handleCheck = useCallback(() => {
    const ip = inputIp.trim()
    if (ip) checkIp(ip)
  }, [inputIp, checkIp])

  const handleCopy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      toast.success(t.copied)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Error')
    }
  }, [t.copied])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleCheck()
  }, [handleCheck])

  return (
    <div className="space-y-4 px-1">
      {/* Header */}
      <div className="text-center space-y-1">
        <h2 className="text-lg font-bold flex items-center justify-center gap-2">
          <Shield className="w-5 h-5 text-rose-400" />
          {t.title}
        </h2>
        <p className="text-xs opacity-40">{t.subtitle}</p>
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
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            {t.analyzing}
          </>
        ) : data ? (
          <>
            <RefreshCw className="w-4 h-4" />
            {t.refreshBtn}
          </>
        ) : (
          <>
            <Shield className="w-4 h-4" />
            {t.checkBtn}
          </>
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
              <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border ${getRiskConfig(data.risk).bg} ${getRiskConfig(data.risk).border}`}>
                {getRiskIcon(data.risk)}
                <span className={`text-xs font-semibold ${getRiskConfig(data.risk).color}`}>
                  {getRiskConfig(data.risk).label}
                </span>
              </div>
            </div>

            {/* Score Gauge Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
              className="rounded-xl border border-white/[0.06] p-5 bg-white/[0.02]"
            >
              <ScoreGauge score={data.score} />
            </motion.div>

            {/* Operator */}
            <SectionCard
              title={t.operator}
              icon={<Building2 className="w-4 h-4 opacity-50" />}
            >
              <InfoRow label={OPERATOR_LABELS[lang].ispName} value={data.operator.ispName} icon={<Server className="w-3.5 h-3.5" />} />
              <InfoRow label={OPERATOR_LABELS[lang].orgName} value={data.operator.orgName} icon={<Building2 className="w-3.5 h-3.5" />} />
              <InfoRow label={OPERATOR_LABELS[lang].connectionType} value={data.operator.connectionType} />
            </SectionCard>

            {/* Location */}
            <SectionCard
              title={t.location}
              icon={<MapPin className="w-4 h-4 opacity-50" />}
            >
              <InfoRow label={LOCATION_LABELS[lang].countryName} value={data.location.countryName} icon={<Globe className="w-3.5 h-3.5" />} />
              <InfoRow label={LOCATION_LABELS[lang].city} value={data.location.city} icon={<MapPin className="w-3.5 h-3.5" />} />
              <InfoRow label={LOCATION_LABELS[lang].state} value={data.location.state} />
              <InfoRow label={LOCATION_LABELS[lang].district} value={data.location.district} />
              <InfoRow label={LOCATION_LABELS[lang].postalCode} value={data.location.postalCode} />

            </SectionCard>

            {/* Proxies & VPN */}
            <SectionCard
              title={t.proxies}
              icon={<Wifi className="w-4 h-4 opacity-50" />}
            >
              {Object.entries(data.proxies).map(([key, value]) => (
                <CheckRow
                  key={key}
                  label={PROXY_LABELS[lang][key] || key}
                  value={value}
                />
              ))}
              {data.residentialProxy && (
                <CheckRow
                  label={PROXY_LABELS[lang].residential_proxy}
                  value={data.residentialProxy}
                />
              )}
            </SectionCard>


          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty state */}
      {!data && !isLoading && !error && (
        <div className="text-center py-12 opacity-30">
          <Shield className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="text-sm">{t.yourIp}</p>
          <p className="text-xs mt-1 opacity-50">{userIp || '...'}</p>
        </div>
      )}
    </div>
  )
}
