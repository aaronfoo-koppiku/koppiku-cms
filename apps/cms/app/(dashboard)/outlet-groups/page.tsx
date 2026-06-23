import { createClient } from '@/lib/supabase/server'
import { OutletGroupsClient } from './outlet-groups-client'

export default async function OutletGroupsPage() {
  const supabase = await createClient()
  const [{ data: groups }, { data: outlets }, { data: members }] = await Promise.all([
    supabase.from('outlet_groups').select('id, name').order('name'),
    supabase.from('outlets').select('id, name').order('name'),
    supabase.from('outlet_group_members').select('group_id, outlet_id'),
  ])

  const membersByGroup: Record<string, string[]> = {}
  for (const m of members ?? []) {
    if (!membersByGroup[m.group_id]) membersByGroup[m.group_id] = []
    membersByGroup[m.group_id].push(m.outlet_id)
  }

  const enriched = (groups ?? []).map(g => ({
    ...g,
    member_ids: membersByGroup[g.id] ?? [],
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Outlet Groups</h1>
        <p className="text-gray-500 text-sm mt-1">Group outlets together for shared scheduling</p>
      </div>
      <OutletGroupsClient groups={enriched} outlets={outlets ?? []} />
    </div>
  )
}
