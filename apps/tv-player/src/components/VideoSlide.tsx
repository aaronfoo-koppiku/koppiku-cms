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

    // Show video after 5s even if canplay never fires on old Android TV Chrome
    const showFallback = setTimeout(() => setReady(true), 5000)

    // Watchdog: if video is visible but currentTime hasn't moved for 8s, force advance
    let lastTime = -1
    const watchdog = setInterval(() => {
      if (!videoRef.current) return
      const ct = videoRef.current.currentTime
      if (ct === lastTime) {
        // Stuck — skip to next slide
        clearInterval(watchdog)
        clearTimeout(showFallback)
        onEnded()
      }
      lastTime = ct
    }, 8000)

    return () => {
      clearTimeout(showFallback)
      clearInterval(watchdog)
    }
  }, [url]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <video
      ref={videoRef}
      src={url}
      preload="auto"
      muted
      playsInline
      onCanPlay={() => setReady(true)}
      onEnded={onEnded}
      style={{
        position: 'absolute', inset: 0, width: '100%', height: '100%',
        objectFit: 'contain', background: '#000',
        opacity: ready ? 1 : 0, transition: 'opacity 0.3s',
      }}
    />
  )
}
