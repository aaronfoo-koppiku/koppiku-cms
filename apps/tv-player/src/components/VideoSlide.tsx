import { useState, useRef, useEffect } from 'react'

interface Props { url: string; onEnded: () => void }

export function VideoSlide({ url, onEnded }: Props) {
  const [ready, setReady] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  // Skip to next if video never loads within 15 seconds
  useEffect(() => {
    const t = setTimeout(onEnded, 15_000)
    return () => clearTimeout(t)
  }, [onEnded])

  function handleCanPlay() {
    setReady(true)
    // autoPlay is unreliable on Android TV — call play() explicitly
    videoRef.current?.play().catch(onEnded)
  }

  return (
    <video
      ref={videoRef}
      src={url}
      autoPlay
      muted
      playsInline
      onCanPlay={handleCanPlay}
      onEnded={onEnded}
      onError={onEnded}
      style={{
        position: 'absolute', inset: 0, width: '100%', height: '100%',
        objectFit: 'contain', background: '#000',
        opacity: ready ? 1 : 0,
        transition: 'opacity 150ms ease-in',
      }}
    />
  )
}
