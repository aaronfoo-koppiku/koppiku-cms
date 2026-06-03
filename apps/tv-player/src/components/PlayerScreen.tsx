import { useEffect, useState } from 'react'
import type { PlaylistItem, Media } from '@koppiku/shared'
import { usePlayback } from '../hooks/usePlayback'
import { useRealtime } from '../hooks/useRealtime'
import { useHeartbeat } from '../hooks/useHeartbeat'
import { usePlaybackLogger } from '../hooks/usePlaybackLogger'
import { ImageSlide } from './ImageSlide'
import { VideoSlide } from './VideoSlide'

type Item = PlaylistItem & { media: Media }

interface Props { deviceId: string; outletId: string }

function SlideContent({ item, onEnded, isActive }: { item: Item; onEnded: () => void; isActive: boolean }) {
  if (item.media.type === 'image') return <ImageSlide url={item.media.cdn_url} alt={item.media.name} />
  return <VideoSlide url={item.media.cdn_url} onEnded={onEnded} isActive={isActive} />
}

export function PlayerScreen({ deviceId, outletId }: Props) {
  const { items, isOffline } = useRealtime(outletId)
  const { currentItem, nextItem, currentIndex, advanceSlide } = usePlayback(items)
  useHeartbeat(deviceId)
  usePlaybackLogger(currentItem, deviceId)

  // A/B double buffer: even indexes → buffer A is active, odd → buffer B
  // Both are always mounted so the inactive one preloads while the active one plays.
  const isAActive = currentIndex % 2 === 0
  const [bufA, setBufA] = useState<Item | null>(null)
  const [bufB, setBufB] = useState<Item | null>(null)

  useEffect(() => {
    if (!currentItem) return
    if (isAActive) {
      setBufA(currentItem)
      if (nextItem) setBufB(nextItem)
    } else {
      setBufB(currentItem)
      if (nextItem) setBufA(nextItem)
    }
  }, [currentItem?.id, nextItem?.id, isAActive])

  if (!bufA && !bufB) {
    if (!currentItem) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#1a0a00' }}>
          <p style={{ fontFamily: 'sans-serif', color: '#6b7280' }}>No content scheduled</p>
        </div>
      )
    }
    return null
  }

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', background: '#000' }}>
      {bufA && (
        <div style={{
          position: 'absolute', inset: 0,
          opacity: isAActive ? 1 : 0,
          transition: 'opacity 0.4s ease',
          zIndex: isAActive ? 2 : 1,
        }}>
          <SlideContent item={bufA} onEnded={advanceSlide} isActive={isAActive} />
        </div>
      )}
      {bufB && (
        <div style={{
          position: 'absolute', inset: 0,
          opacity: isAActive ? 0 : 1,
          transition: 'opacity 0.4s ease',
          zIndex: isAActive ? 1 : 2,
        }}>
          <SlideContent item={bufB} onEnded={advanceSlide} isActive={!isAActive} />
        </div>
      )}
      {isOffline && (
        <div style={{
          position: 'absolute', bottom: 12, right: 12,
          background: 'rgba(0,0,0,0.5)', color: '#9ca3af',
          padding: '4px 10px', borderRadius: 6, fontSize: 12, fontFamily: 'sans-serif',
        }}>
          Offline
        </div>
      )}
    </div>
  )
}
