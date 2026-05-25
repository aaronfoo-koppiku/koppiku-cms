import { usePlayback } from '../hooks/usePlayback'
import { useRealtime } from '../hooks/useRealtime'
import { useHeartbeat } from '../hooks/useHeartbeat'
import { usePlaybackLogger } from '../hooks/usePlaybackLogger'
import { ImageSlide } from './ImageSlide'
import { VideoSlide } from './VideoSlide'

interface Props { deviceId: string; outletId: string }

export function PlayerScreen({ deviceId, outletId }: Props) {
  const { items, isOffline } = useRealtime(outletId)
  const { currentItem, advanceSlide } = usePlayback(items)
  useHeartbeat(deviceId)
  usePlaybackLogger(currentItem, deviceId)

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
        <ImageSlide url={currentItem.media.cdn_url} alt={currentItem.media.name} />
      ) : (
        <VideoSlide url={currentItem.media.cdn_url} onEnded={advanceSlide} />
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
