import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useDevice } from './useDevice'

// Mock supabase
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: () => ({
      insert: vi.fn().mockResolvedValue({ error: null }),
      select: () => ({
        eq: () => ({
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    }),
    channel: () => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnValue({}),
    }),
    removeChannel: vi.fn(),
  },
}))

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
})

describe('useDevice', () => {
  it('generates a deviceId and stores it in localStorage', () => {
    const { result } = renderHook(() => useDevice())
    expect(result.current.deviceId).toMatch(/^[0-9a-f-]{36}$/)
    expect(localStorage.getItem('koppiku_device_id')).toBe(result.current.deviceId)
  })

  it('reuses deviceId across renders', () => {
    const { result: r1 } = renderHook(() => useDevice())
    const id1 = r1.current.deviceId
    const { result: r2 } = renderHook(() => useDevice())
    expect(r2.current.deviceId).toBe(id1)
  })

  it('returns null outletId when device is pending', () => {
    const { result } = renderHook(() => useDevice())
    expect(result.current.outletId).toBeNull()
  })
})
