import { createClient } from '@/lib/supabase/server'

export default async function DashboardPage() {
  const supabase = await createClient()
  const [{ count: outletCount }, { count: deviceCount }, { count: mediaCount }, { count: playlistCount }] =
    await Promise.all([
      supabase.from('outlets').select('*', { count: 'exact', head: true }),
      supabase.from('devices').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('media').select('*', { count: 'exact', head: true }),
      supabase.from('playlists').select('*', { count: 'exact', head: true }).eq('status', 'published'),
    ])

  const stats = [
    { label: 'Outlets', value: outletCount ?? 0 },
    { label: 'Active Screens', value: deviceCount ?? 0 },
    { label: 'Media Files', value: mediaCount ?? 0 },
    { label: 'Published Playlists', value: playlistCount ?? 0 },
  ]

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map(({ label, value }) => (
          <div key={label} className="bg-white rounded-xl p-6 shadow-sm">
            <p className="text-3xl font-bold text-amber-700">{value}</p>
            <p className="text-sm text-gray-500 mt-1">{label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
