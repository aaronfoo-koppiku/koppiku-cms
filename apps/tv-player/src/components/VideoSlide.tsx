import { useRef, useState, useEffect } from 'react'

interface Props { url: string; fallbackUrl?: string; onEnded: () => void }

export function VideoSlide({ url, fallbackUrl, onEnded }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [ready, setReady] = useState(false)
  const [errored, setErrored] = useState(false)
  const retriedRef = useRef(false)

  useEffect(() => {
    setReady(false)
    setErrored(false)
    retriedRef.current = false
    const video = videoRef.current
    if (!video) return
    video.load()
    video.play().catch(() => {})

    // Show video after 5s even if canplay never fires on old Android TV Chrome
    const showFallback = setTimeout(() => setReady(true), 5000)

    // Watchdog: check every 5s if currentTime has moved; if not, retry once
    // then skip — catches stalled videos that never fire onError or onEnded
    let lastTime = -1
    const watchdog = setInterval(() => {
      const v = videoRef.current
      if (!v) return
      const ct = v.currentTime
      if (ct === lastTime) {
        if (!retriedRef.current) {
          // First stall: retry play before giving up
          retriedRef.current = true
          v.load()
          v.play().catch(() => {})
        } else {
          // Still stuck after retry — skip
          clearInterval(watchdog)
          clearTimeout(showFallback)
          onEnded()
        }
      }
      lastTime = ct
    }, 5000)

    return () => {
      clearTimeout(showFallback)
      clearInterval(watchdog)
    }
  }, [url]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      {fallbackUrl && (!ready || errored) && (
        <img
          src={fallbackUrl}
          alt=""
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            objectFit: 'contain', background: '#000',
          }}
        />
      )}
      <video
        ref={videoRef}
        src={url}
        preload="auto"
        muted
        playsInline
        onCanPlay={() => setReady(true)}
        onEnded={onEnded}
        onError={() => {
          if (!retriedRef.current) {
            // Retry once on error before skipping
            retriedRef.current = true
            const v = videoRef.current
            if (v) { v.load(); v.play().catch(() => {}) }
            return
          }
          setErrored(true)
          setTimeout(onEnded, 3000)
        }}
        style={{
          position: 'absolute', inset: 0, width: '100%', height: '100%',
          objectFit: 'contain', background: '#000',
          opacity: ready && !errored ? 1 : 0, transition: 'opacity 0.3s',
        }}
      />
    </>
  )
}
