import { createClient } from '@/lib/supabase/server'
import { createSchedule, deleteSchedule } from './actions'
import { Calendar, Clock, Trash2, Plus } from 'lucide-react'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default async function SchedulesPage() {
  const supabase = await createClient()
  const [{ data: schedules }, { data: playlists }, { data: outlets }] = await Promise.all([
    supabase.from('schedules').select('*, playlist:playlists(name), outlet:outlets(name)').order('priority', { ascending: false }),
    supabase.from('playlists').select('id, name').eq('status', 'published'),
    supabase.from('outlets').select('id, name').order('name'),
  ])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Schedules</h1>
        <p className="text-gray-500 text-sm mt-1">Control when playlists play at each outlet</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Add schedule</h2>
        <form action={createSchedule} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-600">Playlist</label>
              <select name="playlist_id" required
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-400 transition-colors">
                <option value="">Select playlist...</option>
                {(playlists ?? []).map((p: { id: string; name: string }) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-600">Outlet</label>
              <select name="outlet_id"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-400 transition-colors">
                <option value="">All outlets</option>
                {(outlets ?? []).map((o: { id: string; name: string }) => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-600">Start time</label>
              <input type="time" name="start_time" required
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-400 transition-colors" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-600">End time</label>
              <input type="time" name="end_time" required
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-400 transition-colors" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-600">Active from</label>
              <input type="date" name="active_from" required
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-400 transition-colors" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-600">Active until <span className="text-gray-400 font-normal">(blank = forever)</span></label>
              <input type="date" name="active_until"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-400 transition-colors" />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-600">Days <span className="text-gray-400 font-normal">(none = every day)</span></label>
            <div className="flex gap-2">
              {DAYS.map((d, i) => (
                <label key={i} className="flex flex-col items-center gap-1 cursor-pointer group">
                  <input type="checkbox" name="days_of_week" value={i} className="sr-only peer" />
                  <span className="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center text-xs text-gray-500 peer-checked:bg-amber-500 peer-checked:text-white peer-checked:border-amber-500 group-hover:border-amber-300 transition-colors">
                    {d}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-end gap-4 pt-1">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-600">Priority</label>
              <input type="number" name="priority" defaultValue={1} min={1}
                className="w-20 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-400 transition-colors" />
            </div>
            <button type="submit"
              className="bg-amber-500 hover:bg-amber-400 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5">
              <Plus size={15} />
              Add Schedule
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {(schedules ?? []).map((s: any, i: number) => (
          <div key={s.id} className={`flex items-center justify-between px-5 py-4 ${i > 0 ? 'border-t border-gray-100' : ''}`}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-purple-50 rounded-lg flex items-center justify-center">
                <Calendar size={16} className="text-purple-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">{s.playlist?.name}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Clock size={11} className="text-gray-400" />
                  <p className="text-xs text-gray-500">
                    {s.start_time}–{s.end_time} · {s.outlet?.name ?? 'All outlets'} · Priority {s.priority}
                  </p>
                </div>
              </div>
            </div>
            <form action={deleteSchedule.bind(null, s.id)}>
              <button type="submit"
                className="text-gray-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 transition-colors">
                <Trash2 size={15} />
              </button>
            </form>
          </div>
        ))}
        {!schedules?.length && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Calendar size={32} className="text-gray-300 mb-3" />
            <p className="text-sm font-medium text-gray-500">No schedules yet</p>
            <p className="text-xs text-gray-400 mt-1">Add a schedule to control when content plays</p>
          </div>
        )}
      </div>
    </div>
  )
}
