import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { computeTimeTracking, canManageJob } from './serviceJobs.js'

describe('computeTimeTracking', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts a fresh segment when entering IN_PROGRESS for the first time', () => {
    vi.setSystemTime(new Date('2026-01-01T10:00:00.000Z'))
    const result = computeTimeTracking('NEW', 'IN_PROGRESS', {
      startedAt: null,
      workedSeconds: 0,
      currentSegmentStartedAt: null,
    })
    expect(result.startedAt).toEqual(new Date('2026-01-01T10:00:00.000Z'))
    expect(result.currentSegmentStartedAt).toEqual(
      new Date('2026-01-01T10:00:00.000Z'),
    )
    expect(result.workedSeconds).toBe(0)
    expect(result.completedAt).toBeNull()
  })

  it('keeps the original startedAt when resuming after a pause', () => {
    vi.setSystemTime(new Date('2026-01-01T12:00:00.000Z'))
    const result = computeTimeTracking('ON_HOLD', 'IN_PROGRESS', {
      startedAt: new Date('2026-01-01T09:00:00.000Z'),
      workedSeconds: 120,
      currentSegmentStartedAt: null,
    })
    expect(result.startedAt).toEqual(new Date('2026-01-01T09:00:00.000Z'))
    expect(result.workedSeconds).toBe(120)
    expect(result.currentSegmentStartedAt).toEqual(
      new Date('2026-01-01T12:00:00.000Z'),
    )
  })

  it('banks the elapsed segment into workedSeconds when leaving IN_PROGRESS', () => {
    vi.setSystemTime(new Date('2026-01-01T10:05:00.000Z'))
    const result = computeTimeTracking('IN_PROGRESS', 'ON_HOLD', {
      startedAt: new Date('2026-01-01T10:00:00.000Z'),
      workedSeconds: 60,
      // Started 5 minutes (300s) before "now".
      currentSegmentStartedAt: new Date('2026-01-01T10:00:00.000Z'),
    })
    expect(result.workedSeconds).toBe(60 + 300)
    expect(result.currentSegmentStartedAt).toBeNull()
    expect(result.completedAt).toBeNull()
  })

  it('sets completedAt only when the next status is COMPLETED', () => {
    vi.setSystemTime(new Date('2026-01-01T10:05:00.000Z'))
    const completed = computeTimeTracking('IN_PROGRESS', 'COMPLETED', {
      startedAt: new Date('2026-01-01T10:00:00.000Z'),
      workedSeconds: 0,
      currentSegmentStartedAt: new Date('2026-01-01T10:00:00.000Z'),
    })
    expect(completed.completedAt).toEqual(new Date('2026-01-01T10:05:00.000Z'))

    const cancelled = computeTimeTracking('IN_PROGRESS', 'CANCELLED', {
      startedAt: new Date('2026-01-01T10:00:00.000Z'),
      workedSeconds: 0,
      currentSegmentStartedAt: new Date('2026-01-01T10:00:00.000Z'),
    })
    expect(cancelled.completedAt).toBeNull()
  })

  it('does not accumulate time for a status change that was never IN_PROGRESS', () => {
    vi.setSystemTime(new Date('2026-01-01T10:05:00.000Z'))
    const result = computeTimeTracking('NEW', 'CANCELLED', {
      startedAt: null,
      workedSeconds: 0,
      currentSegmentStartedAt: null,
    })
    expect(result.workedSeconds).toBe(0)
  })
})

describe('canManageJob', () => {
  const job = {
    reporterId: 'reporter-1',
    assignees: [{ userId: 'assignee-1' }],
  }

  it('never allows SALES, even as reporter or assignee', () => {
    expect(canManageJob('SALES', 'reporter-1', job)).toBe(false)
    expect(canManageJob('SALES', 'assignee-1', job)).toBe(false)
    expect(canManageJob('SALES', 'someone-else', job)).toBe(false)
  })

  it('always allows ADMIN and SUPER_ENGINEERING regardless of ownership', () => {
    expect(canManageJob('ADMIN', 'someone-else', job)).toBe(true)
    expect(canManageJob('SUPER_ENGINEERING', 'someone-else', job)).toBe(true)
  })

  it('allows ENGINEERING only if reporter or assignee', () => {
    expect(canManageJob('ENGINEERING', 'reporter-1', job)).toBe(true)
    expect(canManageJob('ENGINEERING', 'assignee-1', job)).toBe(true)
    expect(canManageJob('ENGINEERING', 'someone-else', job)).toBe(false)
  })
})
