'use client'

import { useMemo, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { EyeOff, Copy, Check, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { useT } from '@/lib/i18n'

// ============================================================
// TYPES
// ============================================================

type MaskChar = 'x' | '*' | '•'

interface ParsedCc {
  number: string
  month: string
  year: string
  cvv: string
}

interface Variation {
  id: string
  labelKey: string
  value: string
}

// ============================================================
// PARSING — a single card. Accepts `number|mm|yyyy|cvv` (also
// `:`, `;`, spaces and `mm/yy` / `mm-yyyy` date forms).
// ============================================================

function parseCc(raw: string): ParsedCc | null {
  const s = raw.trim().split('\n')[0].trim()
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

    if (!month && d.length <= 2) { month = d.padStart(2, '0'); continue }
    if (!year && d.length === 4) { year = d; continue }
    if (!year && d.length === 2) { year = '20' + d; continue }
    if (!cvv && d.length >= 3 && d.length <= 4) { cvv = d; continue }
  }

  return { number, month, year, cvv }
}

// ============================================================
// MASKING HELPERS
// ============================================================

function maskPan(pan: string, ch: MaskChar, mode: 'only_last4' | 'bin_last4' | 'first12' | 'first6' | 'full'): string {
  const len = pan.length
  switch (mode) {
    case 'only_last4':
      return ch.repeat(Math.max(len - 4, 0)) + pan.slice(-4)
    case 'bin_last4':
      if (len <= 10) return ch.repeat(Math.max(len - 4, 0)) + pan.slice(-4)
      return pan.slice(0, 6) + ch.repeat(len - 10) + pan.slice(-4)
    case 'first12':
      return pan.slice(0, Math.max(len - 4, 0)) + ch.repeat(Math.min(4, len))
    case 'first6':
      return pan.slice(0, 6) + ch.repeat(Math.max(len - 6, 0))
    case 'full':
      return ch.repeat(len)
    default:
      return pan
  }
}

// ============================================================
// VARIATION GENERATION — every mask, all at once
// ============================================================

function buildVariations(p: ParsedCc, ch: MaskChar): Variation[] {
  const date = p.month || p.year ? '|' + [p.month, p.year].filter(Boolean).join('|') : ''
  const dateMasked = p.month || p.year
    ? '|' + [p.month ? ch.repeat(p.month.length) : '', p.year ? ch.repeat(p.year.length) : ''].filter(Boolean).join('|')
    : ''
  const cvvMasked = p.cvv ? '|' + ch.repeat(p.cvv.length) : ''
  const raw = p.number + date + (p.cvv ? '|' + p.cvv : '')

  const candidates: Variation[] = [
    { id: 'only_last4', labelKey: 'ccmask.v_only_last4', value: maskPan(p.number, ch, 'only_last4') + date },
    { id: 'bin_last4', labelKey: 'ccmask.v_bin_last4', value: maskPan(p.number, ch, 'bin_last4') + date },
    { id: 'first12', labelKey: 'ccmask.v_first12', value: maskPan(p.number, ch, 'first12') + date },
    { id: 'first6', labelKey: 'ccmask.v_first6', value: maskPan(p.number, ch, 'first6') + date },
    { id: 'full_number', labelKey: 'ccmask.v_full_number', value: maskPan(p.number, ch, 'full') + date },
  ]

  if (p.cvv) {
    candidates.push({ id: 'cvv_only', labelKey: 'ccmask.v_cvv', value: p.number + date + cvvMasked })
    candidates.push({ id: 'first12_cvv', labelKey: 'ccmask.v_first12_cvv', value: maskPan(p.number, ch, 'first12') + date + cvvMasked })
    candidates.push({ id: 'all', labelKey: 'ccmask.v_all', value: maskPan(p.number, ch, 'full') + dateMasked + cvvMasked })
  }

  // Drop duplicates and any output that masks nothing (equals the raw input).
  const seen = new Set<string>()
  const out: Variation[] = []
  for (const c of candidates) {
    if (c.value === raw) continue
    if (seen.has(c.value)) continue
    seen.add(c.value)
    out.push(c)
  }
  return out
}

const MASK_CHARS: MaskChar[] = ['x', '*', '•']

// ============================================================
// COMPONENT — single card in, all variations out
// ============================================================

export function CcMasker() {
  const { t } = useT()
  const [input, setInput] = useState('')
  const [maskChar, setMaskChar] = useState<MaskChar>('x')
  const [copiedIdx, setCopiedIdx] = useState<string | null>(null)
  const [copiedAll, setCopiedAll] = useState(false)

  const parsed = useMemo(() => parseCc(input), [input])
  const variations = useMemo(() => (parsed ? buildVariations(parsed, maskChar) : []), [parsed, maskChar])

  const copyOne = useCallback(async (v: Variation) => {
    await navigator.clipboard.writeText(v.value)
    setCopiedIdx(v.id)
    toast.success(t('ccmask.copiado'))
    setTimeout(() => setCopiedIdx(null), 1500)
  }, [t])

  const copyAll = useCallback(async () => {
    if (variations.length === 0) return
    await navigator.clipboard.writeText(variations.map(v => v.value).join('\n'))
    setCopiedAll(true)
    toast.success(`${variations.length} ${t('ccmask.copiados')}`)
    setTimeout(() => setCopiedAll(false), 2000)
  }, [variations, t])

  const hasInput = input.trim().length > 0

  return (
    <div className="space-y-4">
      {/* Single card input */}
      <div className="bg-[#111113] theme-card rounded-xl border border-white/[0.06] p-4 space-y-3">
        <label className="text-xs font-medium text-white/50 theme-text-dim uppercase tracking-wider">{t('ccmask.input_label')}</label>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="5530308697853989|02|2029|067"
          inputMode="numeric"
          className="w-full bg-[#09090b] theme-input border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white theme-text placeholder-white/20 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 font-mono transition-colors"
        />

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
      </div>

      {/* Invalid input */}
      {hasInput && !parsed && (
        <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2.5">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className="text-xs text-amber-400/90">{t('ccmask.error_invalid')}</span>
        </div>
      )}

      {/* Variations — generated automatically */}
      {parsed && variations.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-white/40 theme-text-dim">{variations.length} {t('ccmask.resultados')}</span>
            <button
              onClick={copyAll}
              className="flex items-center gap-1.5 text-xs text-amber-500 hover:text-amber-400 transition-colors"
            >
              {copiedAll ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {t('ccmask.copiar_todo')}
            </button>
          </div>

          <div className="space-y-2">
            {variations.map((v) => (
              <motion.div
                key={v.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className="relative rounded-xl border border-white/[0.06] overflow-hidden group"
                style={{ background: 'linear-gradient(135deg, var(--app-card-gradient-from, #1a1a2e), var(--app-card-gradient-to, #111113))' }}
              >
                <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-indigo-500/60" />
                <div className="p-3 pl-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <EyeOff className="w-3.5 h-3.5 text-indigo-400/70 shrink-0" />
                        <span className="text-[10px] uppercase tracking-wider font-medium" style={{ color: 'var(--app-text-faint)' }}>
                          {t(v.labelKey)}
                        </span>
                      </div>
                      <p className="font-mono text-sm tracking-wider break-all" style={{ color: 'var(--app-text-90)' }}>
                        {v.value}
                      </p>
                    </div>
                    <button
                      onClick={() => copyOne(v)}
                      className="p-2 rounded-lg hover:bg-white/[0.06] transition-all duration-200 active:scale-95 shrink-0"
                    >
                      {copiedIdx === v.id ? (
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

      {/* Empty state */}
      {!hasInput && (
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
    </div>
  )
}
