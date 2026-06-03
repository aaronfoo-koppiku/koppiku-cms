import { useRef, useState, useEffect } from 'react'

interface Props { url: string; onEnded: () => void }

export function VideoSlide({ url, onEnded }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setReady(false)
    const video = videoRef.current
    if (!video) return
    video.load()
    video.play().catch(() => {})
    // Fallback: show after 3s if canplay never fires (codec/network issue)
    const fallback = setTimeout(() => setReady(true), 3000)
    return () => clearTimeout(fallback)
  }, [url])

  return (
    <video
      ref={videoRef}
      src={url}
      muted
      playsInline
      onCanPlay={() => setReady(true)}
      onEnded={onEnded}
      style={{
        position: 'absolute', inset: 0, width: '100%', height: '100%',
        objectFit: 'contain', background: '#000',
        opacity: ready ? 1 : 0, transition: 'opacity 0.2s',
      }}
    />
  )
}
