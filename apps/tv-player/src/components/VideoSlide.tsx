import { useRef, useState, useEffect } from 'react'

interface Props { url: string; onEnded: () => void; isActive: boolean }

export function VideoSlide({ url, onEnded, isActive }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [ready, setReady] = useState(false)

  // Reload whenever URL changes (handles both active and preload slots)
  useEffect(() => {
    setReady(false)
    videoRef.current?.load()
  }, [url])

  // Play + 3s fallback only when this slot is the active one
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (!isActive) {
      video.pause()
      return
    }
    video.play().catch(() => {})
    const fallback = setTimeout(() => setReady(true), 3000)
    return () => clearTimeout(fallback)
  }, [isActive, url])

  return (
    <video
      ref={videoRef}
      src={url}
      muted
      playsInline
      onCanPlay={() => setReady(true)}
      onEnded={isActive ? onEnded : undefined}
      style={{
        position: 'absolute', inset: 0, width: '100%', height: '100%',
        objectFit: 'contain', background: '#000',
        opacity: ready ? 1 : 0, transition: 'opacity 0.2s',
      }}
    />
  )
}
