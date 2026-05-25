import { createClient } from '@/lib/supabase/server'
import { PairDeviceForm } from './pair-form'
import { DevicesList } from './devices-list'

export default async function DevicesPage() {
  const supabase = await createClient()
  const [{ data: devices }, { data: outlets }] = await Promise.all([
    supabase
      .from('devices')
      .select('id, name, status, last_seen, pairing_code, pairing_code_expires_at, outlet:outlets(name)')
      .order('status')
      .order('last_seen', { ascending: false, nullsFirst: false }),
    supabase.from('outlets').select('id, name').order('name'),
  ])

  const activeCount = devices?.filter(d => d.status === 'active').length ?? 0

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Devices</h1>
        <p className="text-gray-500 text-sm mt-1">{activeCount} active screen{activeCount !== 1 ? 's' : ''}</p>
      </div>

      <PairDeviceForm outlets={outlets ?? []} />

      <DevicesList initialDevices={(devices ?? []) as any} />
    </div>
  )
}
