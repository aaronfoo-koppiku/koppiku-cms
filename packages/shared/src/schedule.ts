import type { Schedule } from './types'

// Returns the highest-priority schedule active right now for a given outlet.
// outletId=null schedules (nationwide) are always considered.
export function resolveActiveSchedule(
  schedules: Schedule[],
  outletId: string,
  nowMY: Date  // must be in Asia/Kuala_Lumpur time
): Schedule | null {
  const dayOfWeek = nowMY.getDay()
  const currentTime = `${String(nowMY.getHours()).padStart(2, '0')}:${String(nowMY.getMinutes()).padStart(2, '0')}`
  const today = `${nowMY.getFullYear()}-${String(nowMY.getMonth() + 1).padStart(2, '0')}-${String(nowMY.getDate()).padStart(2, '0')}`

  // Note: midnight-spanning schedules (e.g. 22:00–02:00) are not supported.
  // end_time must be > start_time within the same day.
  const active = schedules.filter((s) => {
    const forThisOutlet = s.outlet_id === null || s.outlet_id === outletId
    const dayMatches = s.days_of_week.length === 0 || s.days_of_week.includes(dayOfWeek)
    const timeMatches = currentTime >= s.start_time && currentTime < s.end_time
    const dateMatches = today >= s.active_from && (s.active_until === null || today <= s.active_until)
    return forThisOutlet && dayMatches && timeMatches && dateMatches
  })

  if (active.length === 0) return null
  return active.sort((a, b) => b.priority - a.priority)[0]
}

export function nowInMalaysia(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kuala_Lumpur' }))
}
