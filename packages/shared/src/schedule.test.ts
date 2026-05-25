import { describe, it, expect } from 'vitest'
import { resolveActiveSchedule } from './schedule'
import type { Schedule } from './types'

const base: Schedule = {
  id: '1', playlist_id: 'p1', outlet_id: 'o1',
  start_time: '07:00', end_time: '11:00',
  days_of_week: [], active_from: '2026-01-01', active_until: null, priority: 1,
}

function makeDate(timeStr: string): Date {
  const [h, m] = timeStr.split(':').map(Number)
  const d = new Date('2026-05-25T00:00:00') // Monday = 1
  d.setHours(h, m, 0, 0)
  return d
}

describe('resolveActiveSchedule', () => {
  it('returns schedule when time is within window', () => {
    const result = resolveActiveSchedule([base], 'o1', makeDate('08:00'))
    expect(result?.id).toBe('1')
  })

  it('returns null before start_time', () => {
    const result = resolveActiveSchedule([base], 'o1', makeDate('06:59'))
    expect(result).toBeNull()
  })

  it('returns null at end_time (exclusive)', () => {
    const result = resolveActiveSchedule([base], 'o1', makeDate('11:00'))
    expect(result).toBeNull()
  })

  it('null outlet_id applies to all outlets', () => {
    const nationwide = { ...base, outlet_id: null }
    const result = resolveActiveSchedule([nationwide], 'any-outlet', makeDate('08:00'))
    expect(result?.id).toBe('1')
  })

  it('returns highest priority when two schedules overlap', () => {
    const low = { ...base, id: 'low', priority: 1 }
    const high = { ...base, id: 'high', priority: 10 }
    const result = resolveActiveSchedule([low, high], 'o1', makeDate('08:00'))
    expect(result?.id).toBe('high')
  })

  it('excludes schedule outside active date range', () => {
    const expired = { ...base, active_from: '2026-01-01', active_until: '2026-04-30' }
    const result = resolveActiveSchedule([expired], 'o1', makeDate('08:00'))
    expect(result).toBeNull()
  })

  it('matches schedule on active_from date', () => {
    const startsToday = { ...base, active_from: '2026-05-25', active_until: null }
    const result = resolveActiveSchedule([startsToday], 'o1', makeDate('08:00'))
    expect(result?.id).toBe('1')
  })

  it('filters by day_of_week when set', () => {
    const weekdays = { ...base, days_of_week: [1, 2, 3, 4, 5] } // Mon-Fri
    // makeDate uses 2026-05-25 = Monday = 1, so this should MATCH
    // But the test expects null, implying we need a Sunday scenario
    // 2026-05-24 is Sunday = 0, not in [1,2,3,4,5]
    const sunday = new Date('2026-05-24T00:00:00')
    sunday.setHours(8, 0, 0, 0)
    const result = resolveActiveSchedule([weekdays], 'o1', sunday)
    expect(result).toBeNull()
  })
})
