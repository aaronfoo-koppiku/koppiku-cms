import { createClient } from '@/lib/supabase/server'
import { createPlaylist } from './actions'
import Link from 'next/link'
import type { Playlist } from '@koppiku/shared'

export default async function PlaylistsPage() {
  const supabase = await createClient()
  const { data: playlists } = await supabase.from('playlists').select('*').order('created_at', { ascending: false }) as { data: Playlist[] | null }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Playlists</h1>
      <form action={createPlaylist} className="flex gap-3">
        <input name="name" placeholder="Playlist name" required
          className="flex-1 border rounded-lg px-3 py-2 text-sm bg-white" />
        <button type="submit" className="bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium">
          New Playlist
        </button>
      </form>
      <div className="bg-white rounded-xl shadow-sm divide-y">
        {(playlists ?? []).map((p) => (
          <Link key={p.id} href={`/playlists/${p.id}`}
            className="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
            <span className="font-medium text-sm">{p.name}</span>
            <span className={`text-xs px-2 py-1 rounded-full ${p.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
              {p.status}
            </span>
          </Link>
        ))}
        {!playlists?.length && <p className="px-4 py-6 text-sm text-gray-400">No playlists yet.</p>}
      </div>
    </div>
  )
}
