import { useState, useRef, useEffect } from 'react'

interface Props { url: string; alt: string }

export function ImageSlide({ url, alt }: Props) {
  const [ready, setReady] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)

  // If image is already cached, onLoad won't fire — check complete after mount
  useEffect(() => {
    if (imgRef.current?.complete) setReady(true)
  }, [])

  return (
    <img
      ref={imgRef}
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
