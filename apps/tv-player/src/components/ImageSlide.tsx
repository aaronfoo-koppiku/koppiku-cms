import { useState } from 'react'

interface Props { url: string; alt: string }

export function ImageSlide({ url, alt }: Props) {
  const [ready, setReady] = useState(false)

  return (
    <img
      src={url} alt={alt}
      onLoad={() => setReady(true)}
      style={{
        position: 'absolute', inset: 0, width: '100%', height: '100%',
        objectFit: 'contain', background: '#000',
        opacity: ready ? 1 : 0, transition: 'opacity 0.2s',
      }}
    />
  )
}
