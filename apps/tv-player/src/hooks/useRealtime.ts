import { useState, useEffect, useCallback } from 'react'
import type { PlaylistItem, Media } from '@koppiku/shared'
import { supabase } from '../lib/supabase'

const STORAGE_KEY = 'koppiku_cached_items'

function loadCachedItems(): (PlaylistItem & { media: Media })[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
  } catch { return [] }
}

function saveItems(items: (PlaylistItem & { media: Media })[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
}

async function fetchScheduleItems(outletId: string): Promise<(PlaylistItem & { media: Media })[]> {
  const res = await fetch(`${import.meta.env.VITE_RESOLVE_SCHEDULE_URL}?outlet_id=${outletId}`)
  if (!res.ok) throw new Error('Failed to fetch schedule')
  const { items } = await res.json()
  return items ?? []
}

export function useRealtime(outletId: string) {
  const [items, setItems] = useState<(PlaylistItem & { media: Media })[]>(loadCachedItems)
  const [isOffline, setIsOffline] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const fresh = await fetchScheduleItems(outletId)
      setItems(fresh)
      saveItems(fresh)
      setIsOffline(false)
    } catch {
      setIsOffline(true)
    }
  }, [outletId])

  useEffect(() => { refresh() }, [refresh])

  useEffect(() => {
    const interval = setInterval(refresh, 60_000)
    return () => clearInterval(interval)
  }, [refresh])

  useEffect(() => {
    const channel = supabase
      .channel(`outlet:${outletId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'schedules' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'playlists' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'playlist_items' }, refresh)
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') setIsOffline(true)
        if (status === 'SUBSCRIBED') setIsOffline(false)
      })
    return () => { supabase.removeChannel(channel) }
  }, [outletId, refresh])

  return { items, isOffline }
}
