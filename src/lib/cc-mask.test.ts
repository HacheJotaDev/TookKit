import { describe, it, expect } from 'vitest'
import {
  parseCcRecord,
  maskLastDigits,
  maskKeepEdges,
  maskCvv,
  buildMaskedValue,
  generateMasks,
  buildExportText,
  DEFAULT_MASK_CONFIG,
  MIN_HIDDEN_DIGITS,
} from './cc-mask'

const VALID_16 = '4111111111111111|12|2026|927'
const AMEX = '378282246310005|01|2027|1234'

// ============================================================
// parseCcRecord
// ============================================================

describe('parseCcRecord', () => {
  it('accepts a valid 16-digit record', () => {
    const result = parseCcRecord(VALID_16)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.record).toEqual({
        pan: '4111111111111111',
        month: '12',
        year: '2026',
        cvv: '927',
      })
    }
  })

  it('accepts a 15-digit PAN with a 4-digit CVV (Amex style)', () => {
    const result = parseCcRecord(AMEX)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.record.cvv).toBe('1234')
  })

  it('tolerates spaces and dashes inside the PAN', () => {
    const result = parseCcRecord('4111 1111-1111 1111|12|2026|927')
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.record.pan).toBe('4111111111111111')
  })

  it('rejects empty input', () => {
    expect(parseCcRecord('')).toMatchObject({ ok: false, error: 'empty' })
    expect(parseCcRecord('   ')).toMatchObject({ ok: false, error: 'empty' })
  })

  it('rejects records without exactly 4 parts', () => {
    expect(parseCcRecord('abc')).toMatchObject({ ok: false, error: 'format' })
    expect(parseCcRecord('4111111111111111|12|2026')).toMatchObject({ ok: false, error: 'format' })
    expect(parseCcRecord('4111111111111111|12|2026|927|extra')).toMatchObject({ ok: false, error: 'format' })
  })

  it('rejects a PAN that is too short, too long or non-numeric', () => {
    expect(parseCcRecord('4111111|12|2026|927')).toMatchObject({ ok: false, error: 'pan' })
    expect(parseCcRecord('41111111111111111111|12|2026|927')).toMatchObject({ ok: false, error: 'pan' })
    expect(parseCcRecord('411111111111111a|12|2026|927')).toMatchObject({ ok: false, error: 'pan' })
  })

  it('rejects already-masked PANs (never completes "x" positions)', () => {
    expect(parseCcRecord('411111xxxxxx1111|12|2026|927')).toMatchObject({ ok: false, error: 'pan' })
    expect(parseCcRecord('xxxxxxxxxxxxxxxx|12|2026|927')).toMatchObject({ ok: false, error: 'pan' })
  })

  it('rejects invalid months', () => {
    expect(parseCcRecord('4111111111111111|13|2026|927')).toMatchObject({ ok: false, error: 'month' })
    expect(parseCcRecord('4111111111111111|1|2026|927')).toMatchObject({ ok: false, error: 'month' })
    expect(parseCcRecord('4111111111111111|00|2026|927')).toMatchObject({ ok: false, error: 'month' })
  })

  it('rejects invalid years', () => {
    expect(parseCcRecord('4111111111111111|12|26|927')).toMatchObject({ ok: false, error: 'year' })
    expect(parseCcRecord('4111111111111111|12|2a26|927')).toMatchObject({ ok: false, error: 'year' })
  })

  it('rejects invalid CVVs', () => {
    expect(parseCcRecord('4111111111111111|12|2026|12')).toMatchObject({ ok: false, error: 'cvv' })
    expect(parseCcRecord('4111111111111111|12|2026|12345')).toMatchObject({ ok: false, error: 'cvv' })
    expect(parseCcRecord('4111111111111111|12|2026|12a')).toMatchObject({ ok: false, error: 'cvv' })
  })
})

// ============================================================
// maskLastDigits / maskKeepEdges / maskCvv
// ============================================================

describe('maskLastDigits', () => {
  const pan = '4111111111111111'

  it('hides exactly the last N digits', () => {
    expect(maskLastDigits(pan, 4)).toBe('411111111111xxxx')
    expect(maskLastDigits(pan, 8)).toBe('41111111xxxxxxxx')
  })

  it('keeps the PAN unchanged for count 0', () => {
    expect(maskLastDigits(pan, 0)).toBe(pan)
  })

  it('clamps out-of-range counts', () => {
    expect(maskLastDigits(pan, 99)).toBe('x'.repeat(16))
    expect(maskLastDigits(pan, -3)).toBe(pan)
  })
})

describe('maskKeepEdges', () => {
  const pan = '4111111111111111'

  it('keeps prefix and suffix visible, hides the middle block', () => {
    expect(maskKeepEdges(pan, 6, 4)).toBe('411111xxxxxx1111')
    expect(maskKeepEdges(pan, 4, 4)).toBe('4111xxxxxxxx1111')
    expect(maskKeepEdges(pan, 0, 4)).toBe('xxxxxxxxxxxx1111')
    expect(maskKeepEdges(pan, 4, 0)).toBe('4111xxxxxxxxxxxx')
  })

  it('always keeps at least MIN_HIDDEN_DIGITS positions hidden', () => {
    for (const prefix of [0, 2, 6, 10]) {
      for (const suffix of [0, 2, 4, 10]) {
        const masked = maskKeepEdges(pan, prefix, suffix)
        const hiddenCount = (masked.match(/x/g) || []).length
        expect(hiddenCount).toBeGreaterThanOrEqual(MIN_HIDDEN_DIGITS)
        expect(masked).toHaveLength(pan.length)
      }
    }
  })

  it('clamps correctly on the shortest accepted PAN (8 digits)', () => {
    const short = '41111111'
    const masked = maskKeepEdges(short, 6, 4)
    expect(masked).toHaveLength(8)
    expect((masked.match(/x/g) || []).length).toBeGreaterThanOrEqual(MIN_HIDDEN_DIGITS)
    // The full PAN can never survive the clamp
    expect(masked).not.toBe(short)
  })
})

describe('maskCvv', () => {
  it('masks the CVV fully, keeping its length', () => {
    expect(maskCvv('927')).toBe('xxx')
    expect(maskCvv('1234')).toBe('xxxx')
  })
})

// ============================================================
// buildMaskedValue
// ============================================================

describe('buildMaskedValue', () => {
  it('preserves the original record format with the CVV masked', () => {
    const record = { pan: '4111111111111111', month: '12', year: '2026', cvv: '927' }
    expect(buildMaskedValue(record, '411111xxxxxx1111')).toBe('411111xxxxxx1111|12|2026|xxx')
  })
})

// ============================================================
// generateMasks
// ============================================================

describe('generateMasks', () => {
  const parsed = parseCcRecord(VALID_16)
  if (!parsed.ok) throw new Error('test fixture must parse')
  const record = parsed.record

  it('returns between 5 and 8 masks', () => {
    const masks = generateMasks(record)
    expect(masks.length).toBeGreaterThanOrEqual(5)
    expect(masks.length).toBeLessThanOrEqual(8)
  })

  it('returns only different masks (no duplicated values)', () => {
    const masks = generateMasks(record)
    const values = masks.map(m => m.value)
    expect(new Set(values).size).toBe(values.length)
  })

  it('includes the five fixed templates', () => {
    const ids = generateMasks(record).map(m => m.id)
    for (const id of ['last4', 'last8', 'middle', 'prefix_suffix', 'only_last4']) {
      expect(ids).toContain(id)
    }
  })

  it('includes the three configurable masks', () => {
    const ids = generateMasks(record).map(m => m.id)
    for (const id of ['custom_prefix', 'custom_suffix', 'custom_pair']) {
      expect(ids).toContain(id)
    }
  })

  it('applies the custom configuration to the configurable masks', () => {
    const masks = generateMasks(record, { customPrefixVisible: 10, customSuffixVisible: 8, customPairPrefix: 3, customPairSuffix: 5 })
    const byId = Object.fromEntries(masks.map(m => [m.id, m.value]))
    expect(byId.custom_prefix).toBe('4111111111xxxxxx|12|2026|xxx')
    expect(byId.custom_suffix).toBe('xxxxxxxx11111111|12|2026|xxx')
    expect(byId.custom_pair).toBe('411xxxxxxxx11111|12|2026|xxx')
  })

  it('still yields at least 5 masks with clashing configurations (dedupe)', () => {
    // customPrefixVisible=12 on a 16-digit PAN equals the last4 template value
    const masks = generateMasks(record, { ...DEFAULT_MASK_CONFIG, customPrefixVisible: 12 })
    expect(masks.length).toBeGreaterThanOrEqual(5)
    const values = masks.map(m => m.value)
    expect(new Set(values).size).toBe(values.length)
  })

  it('still yields at least 5 masks with the most conservative configuration', () => {
    const masks = generateMasks(record, { customPrefixVisible: 0, customSuffixVisible: 0, customPairPrefix: 0, customPairSuffix: 0 })
    expect(masks.length).toBeGreaterThanOrEqual(5)
    const values = masks.map(m => m.value)
    expect(new Set(values).size).toBe(values.length)
  })
})

// ============================================================
// Privacy invariants (requirement 5 and 7)
// ============================================================

describe('privacy invariants', () => {
  const parsed = parseCcRecord(VALID_16)
  if (!parsed.ok) throw new Error('test fixture must parse')
  const record = parsed.record

  it('the CVV is always fully masked in every output', () => {
    for (const config of [
      DEFAULT_MASK_CONFIG,
      { customPrefixVisible: 8, customSuffixVisible: 8, customPairPrefix: 8, customPairSuffix: 8 },
    ]) {
      for (const mask of generateMasks(record, config)) {
        const cvvSegment = mask.value.split('|')[3]
        expect(cvvSegment).toBe('x'.repeat(record.cvv.length))
      }
    }
  })

  it('no output ever contains the full PAN', () => {
    for (const mask of generateMasks(record)) {
      expect(mask.value.includes(record.pan)).toBe(false)
    }
  })

  it('every output always hides part of the PAN', () => {
    for (const mask of generateMasks(record)) {
      const panSegment = mask.value.split('|')[0]
      expect(panSegment.includes('x')).toBe(true)
      expect((panSegment.match(/x/g) || []).length).toBeGreaterThanOrEqual(MIN_HIDDEN_DIGITS)
    }
  })

  it('every output keeps the original record format (PAN|MM|AAAA|CVV)', () => {
    for (const mask of generateMasks(record)) {
      const segments = mask.value.split('|')
      expect(segments).toHaveLength(4)
      expect(segments[1]).toBe(record.month)
      expect(segments[2]).toBe(record.year)
    }
  })
})

// ============================================================
// buildExportText
// ============================================================

describe('buildExportText', () => {
  it('exports one masked record per line with a trailing newline', () => {
    const parsed = parseCcRecord(VALID_16)
    if (!parsed.ok) throw new Error('test fixture must parse')
    const masks = generateMasks(parsed.record)
    const text = buildExportText(masks)
    const lines = text.split('\n')
    expect(lines[lines.length - 1]).toBe('')
    expect(lines.filter(Boolean).map(l => l.split('|')[0])).toEqual(masks.map(m => m.value.split('|')[0]))
  })
})
