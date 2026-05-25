import { createClient } from '@/lib/supabase/server'
import { ScheduleView } from './schedule-view'

export default async function SchedulesPage() {
  const supabase = await createClient()
  const [{ data: schedules }, { data: playlists }, { data: outlets }] = await Promise.all([
    supabase.from('schedules').select('*, playlist:playlists(name), outlet:outlets(name)').order('priority', { ascending: false }),
    supabase.from('playlists').select('id, name').eq('status', 'published'),
    supabase.from('outlets').select('id, name').order('name'),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Schedules</h1>
        <p className="text-gray-500 text-sm mt-1">Control when playlists play at each outlet</p>
      </div>
      <ScheduleView
        schedules={(schedules ?? []) as any}
        playlists={playlists ?? []}
        outlets={outlets ?? []}
      />
    </div>
  )
}
