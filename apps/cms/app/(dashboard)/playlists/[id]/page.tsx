import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { PlaylistEditor } from './playlist-editor'
import type { Playlist, PlaylistItem, Media } from '@koppiku/shared'

export default async function PlaylistPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const [{ data: playlist }, { data: items }, { data: allMedia }] = await Promise.all([
    supabase.from('playlists').select('*').eq('id', id).single(),
    supabase.from('playlist_items').select('*, media(*)').eq('playlist_id', id).order('sequence'),
    supabase.from('media').select('*').order('created_at', { ascending: false }),
  ])

  if (!playlist) notFound()

  return (
    <PlaylistEditor
      playlist={playlist as Playlist}
      items={(items ?? []) as (PlaylistItem & { media: Media })[]}
      allMedia={(allMedia ?? []) as Media[]}
    />
  )
}
