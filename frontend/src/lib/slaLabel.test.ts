import { describe, it, expect } from 'vitest'
import { formatSla, hasSla } from './slaLabel'

describe('formatSla', () => {
  it('formats resolution days x hours and response hours', () => {
    expect(
      formatSla({
        slaResolutionDays: 2,
        slaResolutionHours: 4,
        slaResponseHours: 1,
      }),
    ).toBe('2 x 4 respond 1 hr.')
  })

  it('still formats all-zero values (caller decides whether to show it via hasSla)', () => {
    expect(
      formatSla({ slaResolutionDays: 0, slaResolutionHours: 0, slaResponseHours: 0 }),
    ).toBe('0 x 0 respond 0 hr.')
  })
})

describe('hasSla', () => {
  it('is false when every field is zero', () => {
    expect(
      hasSla({ slaResolutionDays: 0, slaResolutionHours: 0, slaResponseHours: 0 }),
    ).toBe(false)
  })

  it('is true if any single field is set', () => {
    expect(
      hasSla({ slaResolutionDays: 1, slaResolutionHours: 0, slaResponseHours: 0 }),
    ).toBe(true)
    expect(
      hasSla({ slaResolutionDays: 0, slaResolutionHours: 1, slaResponseHours: 0 }),
    ).toBe(true)
    expect(
      hasSla({ slaResolutionDays: 0, slaResolutionHours: 0, slaResponseHours: 1 }),
    ).toBe(true)
  })
})
