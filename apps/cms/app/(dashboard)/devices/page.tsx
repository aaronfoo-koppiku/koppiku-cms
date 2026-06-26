import { createClient } from '@/lib/supabase/server'
import { PairDeviceForm } from './pair-form'
import { DevicesList } from './devices-list'

export default async function DevicesPage() {
  const supabase = await createClient()
  const [{ data: devices }, { data: outlets }, { data: allSchedules }, { data: groupMembers }] = await Promise.all([
    supabase
      .from('devices')
      .select('id, name, status, last_seen, pairing_code, pairing_code_expires_at, outlet:outlets(id, name)'),
    supabase.from('outlets').select('id, name').order('name'),
    supabase
      .from('schedules')
      .select('id, outlet_id, outlet_group_id, priority, start_time, end_time, days_of_week, active_from, active_until, playlist:playlists(id, name, status)')
      .order('priority', { ascending: true }),
    supabase.from('outlet_group_members').select('group_id, outlet_id'),
  ])

  // Resolve which playlist is currently active for each outlet
  const now = new Date()
  const currentDay = now.getDay()
  const currentTimeStr = now.toTimeString().slice(0, 5) // HH:MM
  const currentDateStr = now.toISOString().slice(0, 10) // YYYY-MM-DD

  const activeNow = (allSchedules ?? []).filter((s: any) => {
    if (!Array.isArray(s.days_of_week) || !s.days_of_week.includes(currentDay)) return false
    if ((s.start_time ?? '').slice(0, 5) > currentTimeStr) return false
    if ((s.end_time ?? '').slice(0, 5) < currentTimeStr) return false
    if ((s.active_from ?? '') > currentDateStr) return false
    if (s.active_until && s.active_until < currentDateStr) return false
    return (s.playlist as any)?.status === 'published'
  })

  const outletPlaylistMap: Record<string, { name: string; via?: string }> = {}

  for (const outlet of outlets ?? []) {
    const matching = activeNow.filter((s: any) => {
      if (s.outlet_id === outlet.id) return true
      if (!s.outlet_id && !s.outlet_group_id) return true
      if (s.outlet_group_id) {
        return (groupMembers ?? []).some((m: any) => m.group_id === s.outlet_group_id && m.outlet_id === outlet.id)
      }
      return false
    })

    if (!matching.length) continue

    const best = [...matching].sort((a: any, b: any) => {
      // outlet-specific beats group beats all-outlets; within same tier, lower priority number wins
      const aScore = a.outlet_id ? 0 : a.outlet_group_id ? 1 : 2
      const bScore = b.outlet_id ? 0 : b.outlet_group_id ? 1 : 2
      if (aScore !== bScore) return aScore - bScore
      return a.priority - b.priority
    })[0] as any

    outletPlaylistMap[outlet.id] = {
      name: (best.playlist as any).name,
      via: best.outlet_group_id ? 'group' : !best.outlet_id ? 'all outlets' : undefined,
    }
  }

  const activeCount = devices?.filter(d => d.status === 'active').length ?? 0

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Devices</h1>
        <p className="text-gray-500 text-sm mt-1">{activeCount} active screen{activeCount !== 1 ? 's' : ''}</p>
      </div>

      <PairDeviceForm outlets={outlets ?? []} />

      <DevicesList initialDevices={(devices ?? []) as any} outletPlaylistMap={outletPlaylistMap} />
    </div>
  )
}
