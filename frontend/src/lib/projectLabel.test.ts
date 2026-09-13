import { describe, it, expect } from 'vitest'
import { formatProjectName } from './projectLabel'

describe('formatProjectName', () => {
  it('appends the year in parentheses when set', () => {
    expect(formatProjectName({ name: 'ซ่อมบำรุง', projectYear: '2568' })).toBe(
      'ซ่อมบำรุง (2568)',
    )
  })

  it('shows just the name when there is no year', () => {
    expect(formatProjectName({ name: 'ซ่อมบำรุง', projectYear: null })).toBe(
      'ซ่อมบำรุง',
    )
  })
})
