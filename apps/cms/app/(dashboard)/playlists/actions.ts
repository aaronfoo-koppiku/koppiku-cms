'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createPlaylist(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const name = formData.get('name') as string
  const { data } = await supabase.from('playlists').insert({ name, created_by: user?.id ?? null }).select().single()
  revalidatePath('/playlists')
  return data
}

export async function publishPlaylist(id: string) {
  const supabase = await createClient()
  await supabase.from('playlists').update({ status: 'published' }).eq('id', id)
  revalidatePath(`/playlists/${id}`)
}

export async function unpublishPlaylist(id: string) {
  const supabase = await createClient()
  await supabase.from('playlists').update({ status: 'draft' }).eq('id', id)
  revalidatePath(`/playlists/${id}`)
}

export async function addItemToPlaylist(playlistId: string, mediaId: string, sequence: number) {
  const supabase = await createClient()
  await supabase.from('playlist_items').insert({ playlist_id: playlistId, media_id: mediaId, sequence })
  revalidatePath(`/playlists/${playlistId}`)
}

export async function removeItemFromPlaylist(itemId: string, playlistId: string) {
  const supabase = await createClient()
  await supabase.from('playlist_items').delete().eq('id', itemId)
  revalidatePath(`/playlists/${playlistId}`)
}

export async function updateItemsSequence(items: { id: string; sequence: number }[]) {
  const supabase = await createClient()
  await Promise.all(items.map(({ id, sequence }) =>
    supabase.from('playlist_items').update({ sequence }).eq('id', id)
  ))
}

export async function updateItemDuration(itemId: string, duration: number | null, playlistId: string) {
  const supabase = await createClient()
  await supabase.from('playlist_items').update({ display_duration_s: duration }).eq('id', itemId)
  revalidatePath(`/playlists/${playlistId}`)
}
