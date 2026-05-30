import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import type { PlaylistItem, Media } from '@koppiku/shared'

export function usePlaybackLogger(
  currentItem: (PlaylistItem & { media: Media }) | null,
  deviceId: string,
) {
  const startRef = useRef<number>(Date.now())
  const prevItemRef = useRef<string | null>(null)
  const prevPlaylistRef = useRef<string | null>(null)

  useEffect(() => {
    if (!currentItem) return

    if (prevItemRef.current && prevItemRef.current !== currentItem.id) {
      const duration = Math.round((Date.now() - startRef.current) / 1000)
      supabase.from('playback_logs').insert({
        device_id: deviceId,
        playlist_id: prevPlaylistRef.current,
        media_id: prevItemRef.current,
        played_at: new Date(startRef.current).toISOString(),
        duration_s: duration,
      }).then()
    }

    startRef.current = Date.now()
    prevItemRef.current = currentItem.id
    prevPlaylistRef.current = currentItem.playlist_id
  }, [currentItem?.id, deviceId])
}
