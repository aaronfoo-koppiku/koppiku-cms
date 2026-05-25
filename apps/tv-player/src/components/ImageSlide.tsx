interface Props { url: string; alt: string }

export function ImageSlide({ url, alt }: Props) {
  return (
    <img
      src={url} alt={alt}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', background: '#000' }}
    />
  )
}
