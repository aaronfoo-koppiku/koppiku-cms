import { createClient } from '@/lib/supabase/server'
import { createSchedule, deleteSchedule } from './actions'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default async function SchedulesPage() {
  const supabase = await createClient()
  const [{ data: schedules }, { data: playlists }, { data: outlets }] = await Promise.all([
    supabase.from('schedules').select('*, playlist:playlists(name), outlet:outlets(name)').order('priority', { ascending: false }),
    supabase.from('playlists').select('id, name').eq('status', 'published'),
    supabase.from('outlets').select('id, name').order('name'),
  ])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Schedules</h1>

      <form action={createSchedule} className="bg-white p-4 rounded-xl shadow-sm space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Playlist</label>
            <select name="playlist_id" required className="w-full border rounded-lg px-3 py-2 text-sm">
              {(playlists ?? []).map((p: { id: string; name: string }) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Outlet (blank = all outlets)</label>
            <select name="outlet_id" className="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="">All outlets</option>
              {(outlets ?? []).map((o: { id: string; name: string }) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Start time</label>
            <input type="time" name="start_time" required className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">End time</label>
            <input type="time" name="end_time" required className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Active from</label>
            <input type="date" name="active_from" required className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Active until (blank = forever)</label>
            <input type="date" name="active_until" className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Days (none checked = every day)</label>
          <div className="flex gap-3">
            {DAYS.map((d, i) => (
              <label key={i} className="flex items-center gap-1 text-sm cursor-pointer">
                <input type="checkbox" name="days_of_week" value={i} /> {d}
              </label>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Priority</label>
            <input type="number" name="priority" defaultValue={1} min={1}
              className="w-20 border rounded-lg px-3 py-2 text-sm" />
          </div>
          <button type="submit" className="mt-4 bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium">
            Add Schedule
          </button>
        </div>
      </form>

      <div className="bg-white rounded-xl shadow-sm divide-y">
        {(schedules ?? []).map((s: any) => (
          <div key={s.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="text-sm font-medium">{s.playlist?.name}</p>
              <p className="text-xs text-gray-500">
                {s.start_time}–{s.end_time} · {s.outlet?.name ?? 'All outlets'} · Priority {s.priority}
              </p>
            </div>
            <form action={deleteSchedule.bind(null, s.id)}>
              <button type="submit" className="text-xs text-red-500 hover:underline">Delete</button>
            </form>
          </div>
        ))}
        {!schedules?.length && <p className="px-4 py-6 text-sm text-gray-400">No schedules yet.</p>}
      </div>
    </div>
  )
}
