interface Props { url: string; onEnded: () => void }

export function VideoSlide({ url, onEnded }: Props) {
  return (
    <video
      key={url}
      src={url}
      autoPlay
      muted
      playsInline
      onEnded={onEnded}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', background: '#000' }}
    />
  )
}
