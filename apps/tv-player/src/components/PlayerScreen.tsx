import { useEffect } from 'react'
import { usePlayback } from '../hooks/usePlayback'
import { useRealtime } from '../hooks/useRealtime'
import { useHeartbeat } from '../hooks/useHeartbeat'
import { usePlaybackLogger } from '../hooks/usePlaybackLogger'
import { ImageSlide } from './ImageSlide'
import { VideoSlide } from './VideoSlide'

interface Props { deviceId: string; outletId: string }

export function PlayerScreen({ deviceId, outletId }: Props) {
  const { items, fallbackImageUrl, isOffline } = useRealtime(outletId)
  const { currentItem, nextItem, currentIndex, advanceSlide } = usePlayback(items)
  useHeartbeat(deviceId)
  usePlaybackLogger(currentItem, deviceId)

  // Prefetch next item into service worker cache while current plays.
  // Images: new Image() is zero-cost. Videos: fetch() into SW cache so the
  // video element gets an instant cache hit when it mounts next.
  useEffect(() => {
    if (!nextItem) return
    if (nextItem.media.type === 'image') {
      const img = new Image()
      img.src = nextItem.media.cdn_url
    } else {
      fetch(nextItem.media.cdn_url).catch(() => {})
    }
  }, [nextItem?.media.cdn_url])

  if (!currentItem) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: '#1a0a00',
      }}>
        <p style={{ fontFamily: 'sans-serif', color: '#6b7280' }}>No content scheduled</p>
      </div>
    )
  }

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', background: '#000' }}>
      {currentItem.media.type === 'image' ? (
        <ImageSlide
          key={currentIndex}
          url={currentItem.media.cdn_url}
          alt={currentItem.media.name}
        />
      ) : (
        <VideoSlide
          key={currentIndex}
          url={currentItem.media.cdn_url}
          fallbackUrl={fallbackImageUrl ?? undefined}
          onEnded={advanceSlide}
        />
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
