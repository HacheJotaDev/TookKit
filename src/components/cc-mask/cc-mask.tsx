'use client'

import { useState, useCallback, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  EyeOff, Copy, Check, AlertTriangle, SlidersHorizontal
} from 'lucide-react'
import { toast } from 'sonner'
import { useT } from '@/lib/i18n'

// ============================================================
// TYPES
// ============================================================

type MaskMode = 'last4mask' | 'bin_last4' | 'only_last4' | 'first6' | 'all'
type MaskChar = 'x' | '*' | '•'

interface ParsedCc {
  number: string
  month: string
  year: string
  cvv: string
}

interface MaskedResult {
  raw: string
  output: string
  number: string
  valid: boolean
}

// ============================================================
// PARSING — accepts `number|mm|yyyy|cvv` (also `:`, `;`, spaces,
// and `mm/yy` or `mm-yyyy` date forms). Returns null if no PAN found.
// ============================================================

function parseCcLine(raw: string): ParsedCc | null {
  const s = raw.trim()
  if (!s) return null

  const tokens = s.split(/[\s|:;]+/).filter(Boolean)

  let number = ''
  const rest: string[] = []

  for (const tok of tokens) {
    const digits = tok.replace(/\D/g, '')
    if (!number && digits.length >= 12 && digits.length <= 19) {
      number = digits
    } else {
      rest.push(tok)
    }
  }

  if (!number) return null

  let month = ''
  let year = ''
  let cvv = ''

  for (const tok of rest) {
    const dateMatch = tok.match(/^(\d{1,2})[/\-](\d{2,4})$/)
    if (dateMatch) {
      month = dateMatch[1].padStart(2, '0')
      year = dateMatch[2].length === 2 ? '20' + dateMatch[2] : dateMatch[2]
      continue
    }

    const d = tok.replace(/\D/g, '')
    if (!d) continue

    if (!month && d.length <= 2) {
      month = d.padStart(2, '0')
      continue
    }
    if (!year && d.length === 4) {
      year = d
      continue
    }
    if (!year && d.length === 2) {
      year = '20' + d
      continue
    }
    if (!cvv && d.length >= 3 && d.length <= 4) {
      cvv = d
      continue
    }
  }

  return { number, month, year, cvv }
}

// ============================================================
// MASKING
// ============================================================

function maskNumber(num: string, mode: MaskMode, ch: MaskChar): string {
  const len = num.length
  switch (mode) {
    case 'last4mask': // keep first len-4, mask last 4  → 553030869785xxxx
      return num.slice(0, Math.max(len - 4, 0)) + ch.repeat(Math.min(4, len))
    case 'bin_last4': // keep BIN (6) + last 4, mask middle → 553030xxxxxx3989
      if (len <= 10) return ch.repeat(Math.max(len - 4, 0)) + num.slice(-4)
      return num.slice(0, 6) + ch.repeat(len - 10) + num.slice(-4)
    case 'only_last4': // mask all but last 4 → xxxxxxxxxxxx3989
      return ch.repeat(Math.max(len - 4, 0)) + num.slice(-4)
    case 'first6': // keep first 6, mask rest → 553030xxxxxxxxxx
      return num.slice(0, 6) + ch.repeat(Math.max(len - 6, 0))
    case 'all': // full mask → xxxxxxxxxxxxxxxx
      return ch.repeat(len)
    default:
      return num
  }
}

// ============================================================
// MODE DEFINITIONS
// ============================================================

const MODES: { id: MaskMode; labelKey: string; example: string }[] = [
  { id: 'last4mask', labelKey: 'ccmask.modo_last4', example: '553030869785xxxx' },
  { id: 'bin_last4', labelKey: 'ccmask.modo_bin_last4', example: '553030xxxxxx3989' },
  { id: 'only_last4', labelKey: 'ccmask.modo_only_last4', example: 'xxxxxxxxxxxx3989' },
  { id: 'first6', labelKey: 'ccmask.modo_first6', example: '553030xxxxxxxxxx' },
  { id: 'all', labelKey: 'ccmask.modo_all', example: 'xxxxxxxxxxxxxxxx' },
]

const MASK_CHARS: MaskChar[] = ['x', '*', '•']

// ============================================================
// COMPONENT
// ============================================================

export function CcMasker() {
  const { t } = useT()
  const [input, setInput] = useState('')
  const [mode, setMode] = useState<MaskMode>('last4mask')
  const [maskChar, setMaskChar] = useState<MaskChar>('x')
  const [keepDate, setKeepDate] = useState(true)
  const [keepCvv, setKeepCvv] = useState(false)
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)
  const [copiedAll, setCopiedAll] = useState(false)

  // ── Live masking ──
  const results = useMemo<MaskedResult[]>(() => {
    const lines = input.split('\n')
    const out: MaskedResult[] = []
    for (const line of lines) {
      const raw = line.trim()
      if (!raw) continue
      const parsed = parseCcLine(raw)
      if (!parsed) {
        out.push({ raw, output: raw, number: '', valid: false })
        continue
      }
      const maskedNum = maskNumber(parsed.number, mode, maskChar)
      let output = maskedNum
      if (keepDate) {
        if (parsed.month) output += '|' + parsed.month
        if (parsed.year) output += '|' + parsed.year
      }
      if (keepCvv && parsed.cvv) output += '|' + parsed.cvv
      out.push({ raw, output, number: parsed.number, valid: true })
    }
    return out
  }, [input, mode, maskChar, keepDate, keepCvv])

  const validCount = results.filter(r => r.valid).length
  const invalidCount = results.length - validCount

  const copyOne = useCallback(async (text: string, idx: number) => {
    await navigator.clipboard.writeText(text)
    setCopiedIdx(idx)
    toast.success(t('ccmask.copiado'))
    setTimeout(() => setCopiedIdx(null), 1500)
  }, [t])

  const copyAll = useCallback(async () => {
    if (validCount === 0) return
    const text = results.filter(r => r.valid).map(r => r.output).join('\n')
    await navigator.clipboard.writeText(text)
    setCopiedAll(true)
    toast.success(`${validCount} ${t('ccmask.copiados')}`)
    setTimeout(() => setCopiedAll(false), 2000)
  }, [results, validCount, t])

  return (
    <div className="space-y-4">
      {/* Input */}
      <div className="bg-[#111113] theme-card rounded-xl border border-white/[0.06] p-4 space-y-3">
        <label className="text-xs font-medium text-white/50 theme-text-dim uppercase tracking-wider">{t('ccmask.lista')}</label>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={'5530308697853989|02|2029|067\n4147181496481361|09|2028|010'}
          rows={4}
          className="w-full bg-[#09090b] theme-input border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white theme-text placeholder-white/20 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 font-mono resize-none transition-colors"
        />

        {/* Mode selector */}
        <div>
          <label className="flex items-center gap-1.5 text-[11px] font-medium text-white/40 theme-text-dim uppercase tracking-wider mb-2">
            <SlidersHorizontal className="w-3.5 h-3.5" />
            {t('ccmask.modo')}
          </label>
          <div className="flex flex-wrap gap-1.5">
            {MODES.map((m) => {
              const active = mode === m.id
              return (
                <button
                  key={m.id}
                  onClick={() => setMode(m.id)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-medium border transition-all duration-200 ${
                    active
                      ? 'border-amber-500/40 bg-amber-500/15 text-amber-400'
                      : 'border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06]'
                  }`}
                  style={!active ? { color: 'var(--app-text-dim)' } : undefined}
                >
                  {t(m.labelKey)}
                </button>
              )
            })}
          </div>
        </div>

        {/* Mask character */}
        <div>
          <label className="text-[11px] font-medium text-white/40 theme-text-dim uppercase tracking-wider mb-2 block">{t('ccmask.mask_char')}</label>
          <div className="flex gap-1.5">
            {MASK_CHARS.map((ch) => (
              <button
                key={ch}
                onClick={() => setMaskChar(ch)}
                className={`w-11 py-1.5 rounded-lg font-mono text-base font-bold border transition-all duration-200 ${
                  maskChar === ch
                    ? 'border-amber-500/40 bg-amber-500/15 text-amber-400'
                    : 'border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06]'
                }`}
                style={maskChar !== ch ? { color: 'var(--app-text-dim)' } : undefined}
              >
                {ch}
              </button>
            ))}
          </div>
        </div>

        {/* Toggles */}
        <div className="flex gap-2">
          <button
            onClick={() => setKeepDate(v => !v)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border text-[11px] font-medium transition-all duration-200 ${
              keepDate ? 'border-amber-500/40 bg-amber-500/15 text-amber-400' : 'border-white/[0.08] bg-white/[0.03]'
            }`}
            style={!keepDate ? { color: 'var(--app-text-dim)' } : undefined}
          >
            {t('ccmask.fecha')}
            <span className={`w-2 h-2 rounded-full ${keepDate ? 'bg-amber-500' : 'bg-white/20'}`} />
          </button>
          <button
            onClick={() => setKeepCvv(v => !v)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border text-[11px] font-medium transition-all duration-200 ${
              keepCvv ? 'border-amber-500/40 bg-amber-500/15 text-amber-400' : 'border-white/[0.08] bg-white/[0.03]'
            }`}
            style={!keepCvv ? { color: 'var(--app-text-dim)' } : undefined}
          >
            {t('ccmask.cvv')}
            <span className={`w-2 h-2 rounded-full ${keepCvv ? 'bg-amber-500' : 'bg-white/20'}`} />
          </button>
        </div>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-white/40 theme-text-dim">
              {validCount} {t('ccmask.resultados')}
              {invalidCount > 0 && (
                <span className="text-amber-500/70"> · {invalidCount} {t('ccmask.invalidas')}</span>
              )}
            </span>
            <button
              onClick={copyAll}
              className="flex items-center gap-1.5 text-xs text-amber-500 hover:text-amber-400 transition-colors"
            >
              {copiedAll ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {t('ccmask.copiar_todo')}
            </button>
          </div>

          <div className="max-h-[60vh] overflow-y-auto space-y-2 custom-scrollbar">
            {results.map((r, idx) => (
              <motion.div
                key={`${r.raw}-${idx}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(idx * 0.02, 0.3), duration: 0.3 }}
                className="relative rounded-xl border border-white/[0.06] overflow-hidden group"
                style={{ background: 'linear-gradient(135deg, var(--app-card-gradient-from, #1a1a2e), var(--app-card-gradient-to, #111113))' }}
              >
                <div className={`absolute left-0 top-0 bottom-0 w-0.5 ${r.valid ? 'bg-indigo-500/60' : 'bg-red-500/50'}`} />
                <div className="p-3.5 pl-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <EyeOff className={`w-3.5 h-3.5 ${r.valid ? 'text-indigo-400/70' : 'text-red-400/70'} shrink-0`} />
                        <span className="text-[10px] uppercase tracking-wider font-medium" style={{ color: 'var(--app-text-faint)' }}>
                          {r.valid ? t('ccmask.badge') : t('ccmask.invalida')}
                        </span>
                      </div>
                      <p className="font-mono text-sm tracking-wider break-all" style={{ color: r.valid ? 'var(--app-text-90)' : 'var(--app-text-dim)' }}>
                        {r.output}
                      </p>
                      {r.valid && r.output !== r.raw && (
                        <p className="text-[10px] font-mono truncate" style={{ color: 'var(--app-text-faint)' }}>
                          {t('ccmask.origen')}: {r.raw}
                        </p>
                      )}
                    </div>
                    {r.valid && (
                      <button
                        onClick={() => copyOne(r.output, idx)}
                        className="p-2 rounded-lg hover:bg-white/[0.06] transition-all duration-200 active:scale-95 shrink-0"
                      >
                        {copiedIdx === idx ? (
                          <Check className="w-4 h-4 text-green-500" />
                        ) : (
                          <Copy className="w-4 h-4 transition-colors duration-200" style={{ color: 'var(--app-text-dim)' }} />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {results.length === 0 && (
        <div className="bg-[#111113] theme-card rounded-xl border border-white/[0.06] p-8 text-center">
          <div className="relative w-16 h-16 mx-auto mb-4">
            <div className="absolute inset-0 bg-indigo-500/10 rounded-2xl rotate-6" />
            <div className="relative w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/15 flex items-center justify-center">
              <EyeOff className="w-7 h-7 text-indigo-400/50" />
            </div>
          </div>
          <p className="text-sm font-medium mb-1" style={{ color: 'var(--app-text-70)' }}>{t('ccmask.titulo')}</p>
          <p className="text-xs max-w-[240px] mx-auto" style={{ color: 'var(--app-text-dim)' }}>
            {t('ccmask.desc')}
          </p>
        </div>
      )}

      {invalidCount > 0 && (
        <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className="text-xs text-amber-400/90">
            {invalidCount} {t('ccmask.invalidas')} — {t('ccmask.invalidas_desc')}
          </span>
        </div>
      )}
    </div>
  )
}
