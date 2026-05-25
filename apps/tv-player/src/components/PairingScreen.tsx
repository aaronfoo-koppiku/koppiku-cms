import { useState, useEffect } from 'react'

interface Props {
  pairingCode: string
  expiresAt: Date | null
}

function useCountdown(expiresAt: Date | null) {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)

  useEffect(() => {
    if (!expiresAt) return
    const tick = () => setSecondsLeft(Math.max(0, Math.round((expiresAt.getTime() - Date.now()) / 1000)))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [expiresAt])

  return secondsLeft
}

function formatCountdown(s: number): string {
  if (s <= 0) return 'Refreshing...'
  if (s < 60) return `${s}s`
  return `${Math.floor(s / 60)}m ${s % 60}s`
}

export function PairingScreen({ pairingCode, expiresAt }: Props) {
  const secondsLeft = useCountdown(expiresAt)
  const isExpiringSoon = secondsLeft !== null && secondsLeft < 60

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: '#1a0a00', color: '#fff', fontFamily: 'sans-serif',
    }}>
      <p style={{ fontSize: '1.2rem', color: '#d97706', marginBottom: '1rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
        Koppiku TV
      </p>
      <p style={{ fontSize: '1rem', color: '#9ca3af', marginBottom: '2rem' }}>
        Enter this code in the CMS to pair this screen
      </p>
      <div style={{
        fontSize: '5rem', fontWeight: 700, letterSpacing: '0.4em',
        background: '#d97706', color: '#fff', padding: '1.5rem 3rem', borderRadius: '1rem',
      }}>
        {pairingCode}
      </div>
      <p style={{
        marginTop: '2rem', fontSize: '0.85rem',
        color: isExpiringSoon ? '#f87171' : '#6b7280',
      }}>
        {secondsLeft === null
          ? 'Code expires in 1 hour'
          : secondsLeft <= 0
            ? 'Refreshing code...'
            : `Expires in ${formatCountdown(secondsLeft)}`}
      </p>
    </div>
  )
}
