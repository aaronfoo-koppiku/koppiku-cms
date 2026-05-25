import { createClient } from '@/lib/supabase/server'
import { createPlaylist } from './actions'
import Link from 'next/link'
import { ListVideo, ChevronRight, Plus } from 'lucide-react'
import type { Playlist } from '@koppiku/shared'
import { SubmitButton } from '@/components/submit-button'

export default async function PlaylistsPage() {
  const supabase = await createClient()
  const { data: playlists } = await supabase
    .from('playlists')
    .select('*, playlist_items(count)')
    .order('created_at', { ascending: false }) as { data: any[] | null }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Playlists</h1>
          <p className="text-gray-500 text-sm mt-1">{playlists?.length ?? 0} total playlists</p>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">New playlist</h2>
        <form action={createPlaylist} className="flex gap-3">
          <input name="name" placeholder="e.g. Morning Menu, Weekend Specials" required
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-amber-400 transition-colors" />
          <SubmitButton className="bg-amber-500 hover:bg-amber-400 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            <Plus size={15} />
            Create
          </SubmitButton>
        </form>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {(playlists ?? []).map((p, i) => (
          <Link key={p.id} href={`/playlists/${p.id}`}
            className={`flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors group ${i > 0 ? 'border-t border-gray-100' : ''}`}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-amber-50 rounded-lg flex items-center justify-center">
                <ListVideo size={16} className="text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">{p.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {p.playlist_items?.[0]?.count ?? 0} items
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${p.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                {p.status}
              </span>
              <ChevronRight size={16} className="text-gray-300 group-hover:text-gray-400 transition-colors" />
            </div>
          </Link>
        ))}
        {!playlists?.length && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <ListVideo size={32} className="text-gray-300 mb-3" />
            <p className="text-sm font-medium text-gray-500">No playlists yet</p>
            <p className="text-xs text-gray-400 mt-1">Create your first playlist above</p>
          </div>
        )}
      </div>
    </div>
  )
}
