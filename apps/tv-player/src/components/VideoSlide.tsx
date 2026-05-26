import { useState } from 'react'

interface Props { url: string; onEnded: () => void }

export function VideoSlide({ url, onEnded }: Props) {
  const [ready, setReady] = useState(false)
  return (
    <video
      key={url}
      src={url}
      autoPlay
      muted
      playsInline
      onCanPlay={() => setReady(true)}
      onEnded={onEnded}
      style={{
        position: 'absolute', inset: 0, width: '100%', height: '100%',
        objectFit: 'contain', background: '#000',
        opacity: ready ? 1 : 0,
        transition: 'opacity 150ms ease-in',
      }}
    />
  )
}
