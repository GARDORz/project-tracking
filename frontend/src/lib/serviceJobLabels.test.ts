import { describe, it, expect } from 'vitest'
import {
  formatServiceType,
  formatServiceCategory,
  formatSeconds,
  formatDuration,
  formatDurationStat,
} from './serviceJobLabels'

describe('formatServiceType', () => {
  it('appends the free-text label for OTHER-type jobs', () => {
    expect(
      formatServiceType({ type: 'OTHER', typeOther: 'ติดตั้งเพิ่มเติม' }),
    ).toBe('OTHER (ติดตั้งเพิ่มเติม)')
  })

  it('appends checked CM/PM boxes the same way for every other type', () => {
    expect(formatServiceType({ type: 'MA_SERVICE', typeOther: 'CM, PM' })).toBe(
      'MA SERVICE (CM, PM)',
    )
    expect(formatServiceType({ type: 'WARRANTY', typeOther: 'CM' })).toBe(
      'WARRANTY (CM)',
    )
  })

  it('shows just the type label when nothing else was recorded', () => {
    expect(formatServiceType({ type: 'PERCALL', typeOther: null })).toBe(
      'PERCALL',
    )
  })
})

describe('formatServiceCategory', () => {
  it('returns an empty string when no category was set', () => {
    expect(
      formatServiceCategory({ serviceCategory: null, serviceCategoryOther: null }),
    ).toBe('')
  })

  it('returns the plain label when there is no free-text addition', () => {
    expect(
      formatServiceCategory({
        serviceCategory: 'PROFESSIONAL_SERVICE',
        serviceCategoryOther: null,
      }),
    ).toBe('PROFESSIONAL SERVICE')
  })

  it('appends the free-text label for OTHER', () => {
    expect(
      formatServiceCategory({
        serviceCategory: 'OTHER',
        serviceCategoryOther: 'ระบบเครือข่าย',
      }),
    ).toBe('OTHER (ระบบเครือข่าย)')
  })
})

describe('formatSeconds', () => {
  it('formats whole hours and minutes', () => {
    expect(formatSeconds(3 * 3600 + 17 * 60)).toBe('3 ชม. 17 นาที')
  })

  it('rounds down leftover seconds', () => {
    expect(formatSeconds(59)).toBe('0 ชม. 0 นาที')
  })

  it('handles durations over a day the same way (no day rollover)', () => {
    expect(formatSeconds(25 * 3600)).toBe('25 ชม. 0 นาที')
  })
})

describe('formatDuration', () => {
  it('shows "-" for a job that never started', () => {
    expect(formatDuration({ elapsedSeconds: 0, startedAt: null })).toBe('-')
  })

  it('formats the elapsed time once the job has started', () => {
    expect(
      formatDuration({ elapsedSeconds: 3600, startedAt: '2026-01-01T00:00:00Z' }),
    ).toBe('1 ชม. 0 นาที')
  })
})

describe('formatDurationStat', () => {
  it('shows "-" when there is no average to report', () => {
    expect(formatDurationStat({ avgSeconds: null, sampleCount: 0 })).toBe('-')
  })

  it('includes the sample count alongside the formatted average', () => {
    expect(formatDurationStat({ avgSeconds: 3600, sampleCount: 5 })).toBe(
      '1 ชม. 0 นาที (5 งาน)',
    )
  })
})
