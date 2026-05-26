import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import type { PlaylistItem, Media } from '@koppiku/shared'

export function usePlaybackLogger(
  currentItem: (PlaylistItem & { media: Media }) | null,
  deviceId: string,
) {
  const startRef = useRef<number>(Date.now())
  const prevRef = useRef<{ itemId: string; mediaId: string; playlistId: string } | null>(null)

  useEffect(() => {
    if (!currentItem) return

    if (prevRef.current && prevRef.current.itemId !== currentItem.id) {
      const duration = Math.round((Date.now() - startRef.current) / 1000)
      supabase.from('playback_logs').insert({
        device_id: deviceId,
        playlist_id: prevRef.current.playlistId,
        media_id: prevRef.current.mediaId,
        played_at: new Date(startRef.current).toISOString(),
        duration_s: duration,
      }).then()
    }

    startRef.current = Date.now()
    prevRef.current = {
      itemId: currentItem.id,
      mediaId: currentItem.media.id,
      playlistId: currentItem.playlist_id,
    }
  }, [currentItem?.id, deviceId])
}
