import { createClient } from '@/lib/supabase/server'
import { pairDevice } from './actions'

function isOnline(lastSeen: string | null): boolean {
  if (!lastSeen) return false
  return Date.now() - new Date(lastSeen).getTime() < 90_000
}

export default async function DevicesPage() {
  const supabase = await createClient()
  const [{ data: devices }, { data: outlets }] = await Promise.all([
    supabase.from('devices').select('*, outlet:outlets(name)').order('status').order('last_seen', { ascending: false, nullsFirst: false }),
    supabase.from('outlets').select('id, name').order('name'),
  ])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Devices</h1>

      <form action={pairDevice} className="bg-white p-4 rounded-xl shadow-sm flex flex-wrap gap-3 items-end">
        <div>
          <label className="text-xs text-gray-500 block mb-1">Pairing code</label>
          <input name="pairing_code" placeholder="123456" maxLength={6} required
            className="w-28 border rounded-lg px-3 py-2 text-sm font-mono tracking-widest" />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Outlet</label>
          <select name="outlet_id" required className="border rounded-lg px-3 py-2 text-sm">
            {(outlets ?? []).map((o: { id: string; name: string }) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Device name</label>
          <input name="device_name" placeholder="Screen 1" className="border rounded-lg px-3 py-2 text-sm" />
        </div>
        <button type="submit" className="bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium">
          Pair Device
        </button>
      </form>

      <div className="bg-white rounded-xl shadow-sm divide-y">
        {(devices ?? []).map((d: any) => (
          <div key={d.id} className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <div className={`w-2 h-2 rounded-full ${isOnline(d.last_seen) ? 'bg-green-500' : 'bg-gray-300'}`} />
              <div>
                <p className="text-sm font-medium">{d.name ?? 'Unnamed'}</p>
                <p className="text-xs text-gray-500">
                  {d.outlet?.name ?? 'Unpaired'} · Last seen: {d.last_seen ? new Date(d.last_seen).toLocaleString() : 'Never'}
                </p>
              </div>
            </div>
            <span className={`text-xs px-2 py-1 rounded-full ${d.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
              {d.status}
            </span>
          </div>
        ))}
        {!devices?.length && <p className="px-4 py-6 text-sm text-gray-400">No devices yet.</p>}
      </div>
    </div>
  )
}
