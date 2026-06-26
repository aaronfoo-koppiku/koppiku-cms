import { useState, useEffect, useCallback } from 'react'
import type { PlaylistItem, Media } from '@koppiku/shared'
import { supabase } from '../lib/supabase'

const STORAGE_KEY = 'koppiku_cached_items'
const FALLBACK_KEY = 'koppiku_fallback_url'

function loadCachedItems(): (PlaylistItem & { media: Media })[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
  } catch { return [] }
}

function saveItems(items: (PlaylistItem & { media: Media })[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
}

const ROTATION_KEY = 'koppiku_rotation'

export function useRealtime(outletId: string) {
  const [items, setItems] = useState<(PlaylistItem & { media: Media })[]>(loadCachedItems)
  const [fallbackImageUrl, setFallbackImageUrl] = useState<string | null>(
    () => localStorage.getItem(FALLBACK_KEY)
  )
  const [rotation, setRotation] = useState<number>(
    () => Number(localStorage.getItem(ROTATION_KEY) ?? 0)
  )
  const [isOffline, setIsOffline] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_RESOLVE_SCHEDULE_URL}?outlet_id=${outletId}`, {
        headers: { 'authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
      })
      if (!res.ok) throw new Error('Failed to fetch schedule')
      const { items: fresh, fallback_image_url, schedule } = await res.json()
      setItems(fresh ?? [])
      saveItems(fresh ?? [])
      const url: string | null = fallback_image_url ?? null
      setFallbackImageUrl(url)
      if (url) localStorage.setItem(FALLBACK_KEY, url)
      else localStorage.removeItem(FALLBACK_KEY)
      const rot: number = schedule?.playlist?.rotation ?? 0
      setRotation(rot)
      localStorage.setItem(ROTATION_KEY, String(rot))
      setIsOffline(false)
    } catch {
      setIsOffline(true)
    }
  }, [outletId])

  useEffect(() => { refresh() }, [refresh])

  useEffect(() => {
    const interval = setInterval(refresh, 15 * 60 * 1000)
    return () => clearInterval(interval)
  }, [refresh])

  useEffect(() => {
    const channel = supabase
      .channel(`outlet:${outletId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'schedules',
        filter: `outlet_id=eq.${outletId}`,
      }, refresh)
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') setIsOffline(true)
        if (status === 'SUBSCRIBED') setIsOffline(false)
      })
    return () => { supabase.removeChannel(channel) }
  }, [outletId, refresh])

  // Listen for CMS-triggered broadcasts: refresh and clear-cache
  useEffect(() => {
    const channel = supabase
      .channel('cms-control')
      .on('broadcast', { event: 'refresh' }, () => refresh())
      .on('broadcast', { event: 'clear-cache' }, async ({ payload }) => {
        const targetOutletId = (payload as any)?.outlet_id
        if (targetOutletId && targetOutletId !== outletId) return
        if ('caches' in window) await caches.delete('media-cache')
        await refresh()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [refresh])

  return { items, fallbackImageUrl, rotation, isOffline }
}
