// ============================================================
// CC MASK EXTRAPOLATOR — pure masking logic
// ============================================================
// This module performs ONE-WAY masking only. By design it:
//   - NEVER generates card numbers, completes missing digits
//     or fills the masked positions ("x").
//   - NEVER validates cards or interacts with payment systems.
//   - Performs NO I/O: no network, no storage, no logging.
// The PAN is accepted as user input, partially masked and
// nothing else. Masked output is always strictly less
// sensitive than the input.
// ============================================================

export interface CcRecord {
  pan: string
  month: string
  year: string
  cvv: string
}

export type CcMaskErrorCode =
  | 'empty'
  | 'format'
  | 'pan'
  | 'month'
  | 'year'
  | 'cvv'

export type ParseResult =
  | { ok: true; record: CcRecord }
  | { ok: false; error: CcMaskErrorCode }

export interface MaskTemplate {
  id: string
  labelKey: string
  value: string
}

export interface MaskConfig {
  /** Custom A — leading digits kept visible */
  customPrefixVisible: number
  /** Custom B — trailing digits kept visible */
  customSuffixVisible: number
  /** Custom C — leading digits kept visible */
  customPairPrefix: number
  /** Custom C — trailing digits kept visible */
  customPairSuffix: number
}

export const DEFAULT_MASK_CONFIG: MaskConfig = {
  customPrefixVisible: 4,
  customSuffixVisible: 6,
  customPairPrefix: 2,
  customPairSuffix: 4,
}

/** Minimum number of PAN digits that must stay hidden on every mask. */
export const MIN_HIDDEN_DIGITS = 4

// PAN: digits only (ISO/IEC 7812 range). Any other character
// (including already-masked positions) is rejected: this tool
// never "completes" numbers.
const PAN_RE = /^\d{8,19}$/
const MONTH_RE = /^(0[1-9]|1[0-2])$/
const YEAR_RE = /^\d{4}$/
const CVV_RE = /^\d{3,4}$/

/**
 * Parses a "PAN|MM|AAAA|CVV" record.
 * Returns a discriminated result instead of throwing.
 */
export function parseCcRecord(raw: string): ParseResult {
  if (!raw || raw.trim() === '') return { ok: false, error: 'empty' }

  const parts = raw.trim().split('|')
  if (parts.length !== 4) return { ok: false, error: 'format' }

  // Tolerate spaces/dashes typed inside the PAN; the underlying
  // positions must still be plain digits.
  const pan = parts[0].replace(/[\s-]/g, '')
  if (!PAN_RE.test(pan)) return { ok: false, error: 'pan' }

  const month = parts[1].trim()
  if (!MONTH_RE.test(month)) return { ok: false, error: 'month' }

  const year = parts[2].trim()
  if (!YEAR_RE.test(year)) return { ok: false, error: 'year' }

  const cvv = parts[3].trim()
  if (!CVV_RE.test(cvv)) return { ok: false, error: 'cvv' }

  return { ok: true, record: { pan, month, year, cvv } }
}

/** Replaces exactly the last `count` positions of `pan` with 'x'. */
export function maskLastDigits(pan: string, count: number): string {
  const n = Math.max(0, Math.min(count, pan.length))
  return pan.slice(0, pan.length - n) + 'x'.repeat(n)
}

/**
 * Keeps `prefix` leading and `suffix` trailing digits visible;
 * everything in between becomes 'x'.
 * Safety clamp: at least MIN_HIDDEN_DIGITS positions always stay
 * hidden, so no configuration can return the full PAN visible.
 */
export function maskKeepEdges(pan: string, prefix: number, suffix: number): string {
  let p = Math.max(0, Math.min(prefix, pan.length))
  let s = Math.max(0, Math.min(suffix, pan.length))

  const maxVisible = Math.max(pan.length - MIN_HIDDEN_DIGITS, 0)
  while (p + s > maxVisible) {
    if (p >= s && p > 0) p--
    else if (s > 0) s--
    else break
  }

  const head = pan.slice(0, p)
  const tail = s > 0 ? pan.slice(pan.length - s) : ''
  const hidden = 'x'.repeat(Math.max(pan.length - p - s, 0))
  return head + hidden + tail
}

/** The CVV is always fully masked, keeping its length. */
export function maskCvv(cvv: string): string {
  return 'x'.repeat(cvv.length)
}

/** Joins a masked PAN with the original month/year and the masked CVV. */
export function buildMaskedValue(record: CcRecord, maskedPan: string): string {
  return `${maskedPan}|${record.month}|${record.year}|${maskCvv(record.cvv)}`
}

/**
 * Builds the full set of masks from one parsed record:
 *   1-5. fixed templates (last 4 hidden, last 8 hidden, middle block
 *        hidden, prefix+suffix visible, only last 4 visible)
 *   6-8. three configurable masks (prefix / suffix / prefix+suffix)
 * Returns between 5 and 8 different masks: duplicates produced by
 * equivalent configurations are removed, order is preserved.
 */
export function generateMasks(
  record: CcRecord,
  config: MaskConfig = DEFAULT_MASK_CONFIG
): MaskTemplate[] {
  const candidates: MaskTemplate[] = [
    { id: 'last4', labelKey: 'ccmask.tpl_last4', value: buildMaskedValue(record, maskLastDigits(record.pan, 4)) },
    { id: 'last8', labelKey: 'ccmask.tpl_last8', value: buildMaskedValue(record, maskLastDigits(record.pan, 8)) },
    { id: 'middle', labelKey: 'ccmask.tpl_middle', value: buildMaskedValue(record, maskKeepEdges(record.pan, 6, 4)) },
    { id: 'prefix_suffix', labelKey: 'ccmask.tpl_prefix_suffix', value: buildMaskedValue(record, maskKeepEdges(record.pan, 4, 4)) },
    { id: 'only_last4', labelKey: 'ccmask.tpl_only_last4', value: buildMaskedValue(record, maskKeepEdges(record.pan, 0, 4)) },
    { id: 'custom_prefix', labelKey: 'ccmask.tpl_custom_prefix', value: buildMaskedValue(record, maskKeepEdges(record.pan, config.customPrefixVisible, 0)) },
    { id: 'custom_suffix', labelKey: 'ccmask.tpl_custom_suffix', value: buildMaskedValue(record, maskKeepEdges(record.pan, 0, config.customSuffixVisible)) },
    { id: 'custom_pair', labelKey: 'ccmask.tpl_custom_pair', value: buildMaskedValue(record, maskKeepEdges(record.pan, config.customPairPrefix, config.customPairSuffix)) },
  ]

  const seen = new Set<string>()
  const unique: MaskTemplate[] = []
  for (const mask of candidates) {
    if (seen.has(mask.value)) continue
    seen.add(mask.value)
    unique.push(mask)
  }
  return unique
}

/** Plain-text export: one masked record per line (masked data only). */
export function buildExportText(masks: MaskTemplate[]): string {
  return masks.map(m => m.value).join('\n') + '\n'
}
