import { createClient } from '@/lib/supabase/server'
import { Store, Monitor, Image, ListVideo, TrendingUp } from 'lucide-react'

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
    { label: 'Outlets', value: outletCount ?? 0, icon: Store, color: 'bg-blue-50 text-blue-600' },
    { label: 'Active Screens', value: deviceCount ?? 0, icon: Monitor, color: 'bg-green-50 text-green-600' },
    { label: 'Media Files', value: mediaCount ?? 0, icon: Image, color: 'bg-purple-50 text-purple-600' },
    { label: 'Published Playlists', value: playlistCount ?? 0, icon: ListVideo, color: 'bg-amber-50 text-amber-600' },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Overview of your digital signage network</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color} mb-3`}>
              <Icon size={18} />
            </div>
            <p className="text-3xl font-bold text-gray-900">{value}</p>
            <p className="text-sm text-gray-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center gap-2 text-gray-500 mb-1">
          <TrendingUp size={16} />
          <span className="text-sm font-medium">Quick start</span>
        </div>
        <ol className="mt-3 space-y-2 text-sm text-gray-600 list-decimal list-inside">
          <li>Create an <a href="/outlets" className="text-amber-600 hover:underline font-medium">outlet</a> for each Koppiku location</li>
          <li>Upload images or videos in the <a href="/media" className="text-amber-600 hover:underline font-medium">media library</a></li>
          <li>Build a <a href="/playlists" className="text-amber-600 hover:underline font-medium">playlist</a> and publish it</li>
          <li>Set a <a href="/schedules" className="text-amber-600 hover:underline font-medium">schedule</a> to control when it plays</li>
          <li>Pair your TV screen in <a href="/devices" className="text-amber-600 hover:underline font-medium">devices</a></li>
        </ol>
      </div>
    </div>
  )
}
