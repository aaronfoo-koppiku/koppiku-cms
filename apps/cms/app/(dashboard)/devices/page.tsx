import { createClient } from '@/lib/supabase/server'
import { Monitor, Wifi, WifiOff } from 'lucide-react'
import { PairDeviceForm } from './pair-form'

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
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Devices</h1>
        <p className="text-gray-500 text-sm mt-1">
          {devices?.filter(d => d.status === 'active').length ?? 0} active screens
        </p>
      </div>

      <PairDeviceForm outlets={outlets ?? []} />

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {(devices ?? []).map((d: any, i: number) => {
          const online = isOnline(d.last_seen)
          return (
            <div key={d.id} className={`flex items-center justify-between px-5 py-4 ${i > 0 ? 'border-t border-gray-100' : ''}`}>
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${online ? 'bg-green-50' : 'bg-gray-100'}`}>
                  <Monitor size={16} className={online ? 'text-green-600' : 'text-gray-400'} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-900">{d.name ?? 'Unnamed screen'}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${d.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                      {d.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {d.outlet?.name ?? 'No outlet'} · Last seen: {d.last_seen ? new Date(d.last_seen).toLocaleString('en-MY') : 'Never'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                {online
                  ? <><Wifi size={14} className="text-green-500" /><span className="text-green-600 font-medium">Online</span></>
                  : <><WifiOff size={14} className="text-gray-400" /><span className="text-gray-400">Offline</span></>
                }
              </div>
            </div>
          )
        })}
        {!devices?.length && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Monitor size={32} className="text-gray-300 mb-3" />
            <p className="text-sm font-medium text-gray-500">No devices yet</p>
            <p className="text-xs text-gray-400 mt-1">Pair a screen using the code shown on your TV</p>
          </div>
        )}
      </div>
    </div>
  )
}
