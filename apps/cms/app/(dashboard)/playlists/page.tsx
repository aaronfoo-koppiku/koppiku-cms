import { createClient } from '@/lib/supabase/server'
import { createPlaylist } from './actions'
import { Plus } from 'lucide-react'
import { SubmitButton } from '@/components/submit-button'
import { PlaylistsClient } from './playlists-client'

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
        <PlaylistsClient playlists={playlists ?? []} />
      </div>
    </div>
  )
}
