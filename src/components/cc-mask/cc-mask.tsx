'use client'

import { useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { EyeOff, Copy, Check, Download, ShieldCheck, Minus, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { useT } from '@/lib/i18n'
import {
  parseCcRecord,
  generateMasks,
  buildExportText,
  DEFAULT_MASK_CONFIG,
  type MaskConfig,
  type MaskTemplate,
  type CcMaskErrorCode,
} from '@/lib/cc-mask'

const ERROR_KEYS: Record<CcMaskErrorCode, string> = {
  empty: 'ccmask.error_empty',
  format: 'ccmask.error_format',
  pan: 'ccmask.error_pan',
  month: 'ccmask.error_month',
  year: 'ccmask.error_year',
  cvv: 'ccmask.error_cvv',
}

function Stepper({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  const clamp = (v: number) => Math.min(Math.max(v, min), max)
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs font-medium" style={{ color: 'var(--app-text-dim)' }}>{label}</span>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          aria-label={`${label} -1`}
          onClick={() => onChange(clamp(value - 1))}
          disabled={value <= min}
          className="w-7 h-7 rounded-lg border border-white/[0.08] flex items-center justify-center hover:bg-white/[0.06] active:scale-95 transition-all disabled:opacity-30 disabled:pointer-events-none"
          style={{ color: 'var(--app-text)' }}
        >
          <Minus className="w-3 h-3" />
        </button>
        <span className="w-6 text-center text-sm font-mono" style={{ color: 'var(--app-text)' }}>{value}</span>
        <button
          type="button"
          aria-label={`${label} +1`}
          onClick={() => onChange(clamp(value + 1))}
          disabled={value >= max}
          className="w-7 h-7 rounded-lg border border-white/[0.08] flex items-center justify-center hover:bg-white/[0.06] active:scale-95 transition-all disabled:opacity-30 disabled:pointer-events-none"
          style={{ color: 'var(--app-text)' }}
        >
          <Plus className="w-3 h-3" />
        </button>
      </div>
    </div>
  )
}

export function CcMaskTool() {
  const { t } = useT()
  const [input, setInput] = useState('')
  const [config, setConfig] = useState<MaskConfig>(DEFAULT_MASK_CONFIG)
  const [masks, setMasks] = useState<MaskTemplate[] | null>(null)
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)
  const [copiedAll, setCopiedAll] = useState(false)

  // Re-applies the current config when it changes and a record was
  // already generated. Everything runs locally, nothing is persisted.
  const applyConfig = useCallback((next: MaskConfig) => {
    setConfig(next)
    const parsed = parseCcRecord(input)
    if (parsed.ok) setMasks(generateMasks(parsed.record, next))
  }, [input])

  const handleGenerate = useCallback(() => {
    const parsed = parseCcRecord(input)
    if (!parsed.ok) {
      toast.error(t(ERROR_KEYS[parsed.error]))
      return
    }
    const result = generateMasks(parsed.record, config)
    setMasks(result)
    toast.success(`${result.length} ${t('ccmask.generadas')}`)
  }, [input, config, t])

  const copyMask = useCallback(async (value: string, idx: number) => {
    await navigator.clipboard.writeText(value)
    setCopiedIdx(idx)
    toast.success(t('ccmask.copiado'))
    setTimeout(() => setCopiedIdx(null), 1500)
  }, [t])

  const copyAll = useCallback(async () => {
    if (!masks || masks.length === 0) return
    await navigator.clipboard.writeText(buildExportText(masks).trimEnd())
    setCopiedAll(true)
    toast.success(`${masks.length} ${t('ccmask.copiadas')}`)
    setTimeout(() => setCopiedAll(false), 2000)
  }, [masks, t])

  // TXT export contains masked data only — never the raw input.
  const exportTxt = useCallback(() => {
    if (!masks || masks.length === 0) return
    const blob = new Blob([buildExportText(masks)], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `mascaras_cc_${new Date().toISOString().slice(0, 10)}.txt`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(t('ccmask.exportado'))
  }, [masks, t])

  return (
    <div className="space-y-4">
      {/* Record input */}
      <div className="bg-[#111113] theme-card rounded-xl border border-white/[0.06] p-4 space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-white/50 theme-text-dim uppercase tracking-wider">{t('ccmask.input_label')}</label>
          <span className="text-[10px] font-mono text-amber-500/60 bg-amber-500/10 px-1.5 py-0.5 rounded-md">PAN|MM|AAAA|CVV</span>
        </div>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="4111111111111111|12|2026|123"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          className="w-full bg-[#09090b] theme-input border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white theme-text placeholder-white/20 focus:outline-none focus:border-amber-500/50 font-mono transition-colors"
        />

        <button
          onClick={handleGenerate}
          className="w-full bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-black font-bold rounded-xl py-3 text-sm transition-all duration-300 flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 active:scale-[0.98]"
        >
          <EyeOff className="w-4 h-4" />
          {t('ccmask.generar')}
        </button>
      </div>

      {/* Configurable masks */}
      <div className="bg-[#111113] theme-card rounded-xl border border-white/[0.06] p-4 space-y-3">
        <label className="text-xs font-medium text-white/50 theme-text-dim uppercase tracking-wider">{t('ccmask.cfg_title')}</label>
        <Stepper
          label={t('ccmask.cfg_prefix')}
          value={config.customPrefixVisible}
          min={0}
          max={12}
          onChange={(v) => applyConfig({ ...config, customPrefixVisible: v })}
        />
        <Stepper
          label={t('ccmask.cfg_suffix')}
          value={config.customSuffixVisible}
          min={0}
          max={12}
          onChange={(v) => applyConfig({ ...config, customSuffixVisible: v })}
        />
        <div className="border-t border-white/[0.06] pt-3 space-y-3">
          <Stepper
            label={t('ccmask.cfg_pair_prefix')}
            value={config.customPairPrefix}
            min={0}
            max={8}
            onChange={(v) => applyConfig({ ...config, customPairPrefix: v })}
          />
          <Stepper
            label={t('ccmask.cfg_pair_suffix')}
            value={config.customPairSuffix}
            min={0}
            max={8}
            onChange={(v) => applyConfig({ ...config, customPairSuffix: v })}
          />
        </div>
      </div>

      {/* Results */}
      {masks && masks.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-white/40 theme-text-dim">{masks.length} {t('ccmask.resultados')}</span>
            <div className="flex items-center gap-3">
              <button
                onClick={copyAll}
                className="flex items-center gap-1.5 text-xs text-amber-500 hover:text-amber-400 transition-colors"
              >
                {copiedAll ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {t('ccmask.copiar_todo')}
              </button>
              <button
                onClick={exportTxt}
                className="flex items-center gap-1.5 text-xs text-amber-500 hover:text-amber-400 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                {t('ccmask.exportar')}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {masks.map((mask, idx) => (
              <motion.div
                key={mask.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03, duration: 0.3 }}
                className="relative rounded-xl border border-white/[0.06] overflow-hidden"
                style={{ background: 'linear-gradient(135deg, var(--app-card-gradient-from, #1a1a2e), var(--app-card-gradient-to, #111113))' }}
              >
                <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-amber-500/60" />
                <div className="p-3.5 pl-4 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="text-[11px] uppercase tracking-wider font-medium truncate" style={{ color: 'var(--app-text-dim)' }}>
                      {t(mask.labelKey)}
                    </p>
                    <p className="text-sm font-mono leading-snug tracking-wide break-all" style={{ color: 'var(--app-text-90)' }}>
                      {mask.value}
                    </p>
                  </div>
                  <button
                    onClick={() => copyMask(mask.value, idx)}
                    aria-label={t('ccmask.copiado')}
                    className="p-2 rounded-lg hover:bg-white/[0.06] transition-all duration-200 active:scale-95 shrink-0"
                  >
                    {copiedIdx === idx ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4 transition-colors duration-200" style={{ color: 'var(--app-text-dim)' }} />
                    )}
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Privacy note */}
      <div className="rounded-xl border border-white/[0.06] bg-[#111113] theme-card p-3.5 flex items-start gap-2.5">
        <ShieldCheck className="w-4 h-4 text-green-500/80 shrink-0 mt-0.5" />
        <p className="text-[11px] leading-relaxed" style={{ color: 'var(--app-text-dim)' }}>
          {t('ccmask.privacy')}
        </p>
      </div>
    </div>
  )
}
