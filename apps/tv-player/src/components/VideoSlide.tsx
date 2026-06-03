import { useRef, useState, useEffect } from 'react'

interface Props { url: string; onEnded: () => void; isActive: boolean }

export function VideoSlide({ url, onEnded, isActive }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [ready, setReady] = useState(false)
  // Ref so onPlaying handler always reads current isActive without stale closure
  const isActiveRef = useRef(isActive)
  isActiveRef.current = isActive

  // On URL change: load + silently play-then-pause in background so onPlaying fires
  // and ready=true before this slot ever becomes active. Uses a ref snapshot so
  // this effect only re-runs on URL changes, not every isActive flip.
  useEffect(() => {
    setReady(false)
    const video = videoRef.current
    if (!video) return
    video.load()
    if (!isActiveRef.current) {
      video.play().catch(() => {})
    }
  }, [url])

  // When this slot becomes active: restart from 0 and ensure playing + fallback
  useEffect(() => {
    if (!isActive) return
    const video = videoRef.current
    if (!video) return
    video.currentTime = 0
    video.play().catch(() => {})
    const fallback = setTimeout(() => setReady(true), 3000)
    return () => clearTimeout(fallback)
  }, [isActive, url])

  return (
    <video
      ref={videoRef}
      src={url}
      preload="auto"
      muted
      playsInline
      onPlaying={() => {
        setReady(true)
        // Pause the preloading video after first frame renders; it'll restart
        // from 0 when this slot activates, already marked ready
        if (!isActiveRef.current) videoRef.current?.pause()
      }}
      onEnded={isActive ? onEnded : undefined}
      style={isActive ? {
        position: 'absolute', inset: 0, width: '100%', height: '100%',
        objectFit: 'contain', background: '#000',
        opacity: ready ? 1 : 0, transition: 'opacity 0.2s',
      } : {
        // Off-screen while preloading — prevents Chrome's grey overlay from
        // showing through the crossfade layer on old Android TV Chrome builds
        position: 'absolute', width: 1, height: 1,
        left: -9999, top: -9999, opacity: 0,
      }}
    />
  )
}
