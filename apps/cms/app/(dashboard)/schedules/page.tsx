import { createClient } from '@/lib/supabase/server'
import { ScheduleView } from './schedule-view'
import { ForceRefreshButton, ClearCacheButton } from '@/components/force-refresh-button'

export default async function SchedulesPage() {
  const supabase = await createClient()
  const [
    { data: schedules },
    { data: playlists },
    { data: outlets },
    { data: groups },
    { data: groupMembers },
  ] = await Promise.all([
    supabase
      .from('schedules')
      .select('*, playlist:playlists(name), outlet:outlets(name), outlet_group:outlet_groups(name)')
      .order('priority', { ascending: false }),
    supabase.from('playlists').select('id, name').eq('status', 'published'),
    supabase.from('outlets').select('id, name').order('name'),
    supabase.from('outlet_groups').select('id, name').order('name'),
    supabase.from('outlet_group_members').select('group_id, outlet_id'),
  ])

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Schedules</h1>
          <p className="text-gray-500 text-sm mt-1">Control when playlists play at each outlet</p>
        </div>
        <div className="flex items-center gap-2">
          <ClearCacheButton />
          <ForceRefreshButton />
        </div>
      </div>
      <ScheduleView
        schedules={(schedules ?? []) as any}
        playlists={playlists ?? []}
        outlets={outlets ?? []}
        groups={groups ?? []}
        groupMembers={groupMembers ?? []}
      />
    </div>
  )
}
