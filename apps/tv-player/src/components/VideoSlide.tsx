import { useRef, useState, useEffect } from 'react'

const FALLBACK_URL = import.meta.env.VITE_FALLBACK_IMAGE_URL as string | undefined

interface Props { url: string; onEnded: () => void }

export function VideoSlide({ url, onEnded }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [ready, setReady] = useState(false)
  const [errored, setErrored] = useState(false)

  useEffect(() => {
    setReady(false)
    setErrored(false)
    const video = videoRef.current
    if (!video) return
    video.load()
    video.play().catch(() => {})

    // Show video after 5s even if canplay never fires on old Android TV Chrome
    const showFallback = setTimeout(() => setReady(true), 5000)

    // Watchdog: if currentTime hasn't moved for 8s while active, force advance
    let lastTime = -1
    const watchdog = setInterval(() => {
      if (!videoRef.current) return
      const ct = videoRef.current.currentTime
      if (ct === lastTime) {
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
    <>
      {/* Fallback shown while loading or on error */}
      {FALLBACK_URL && (!ready || errored) && (
        <img
          src={FALLBACK_URL}
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
          setErrored(true)
          // Advance to next slide after 3s so a broken video doesn't block the playlist
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
