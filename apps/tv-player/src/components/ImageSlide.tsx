import { useState, useRef, useLayoutEffect } from 'react'

interface Props { url: string; alt: string }

export function ImageSlide({ url, alt }: Props) {
  const [ready, setReady] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)

  // useLayoutEffect fires before paint — resets ready and catches cached images
  // in the same tick, avoiding any opacity-0 flash for already-cached URLs
  useLayoutEffect(() => {
    setReady(false)
    if (imgRef.current?.complete) setReady(true)
  }, [url])

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
