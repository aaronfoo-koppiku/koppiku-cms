interface Props { pairingCode: string }

export function PairingScreen({ pairingCode }: Props) {
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
      <p style={{ marginTop: '2rem', fontSize: '0.85rem', color: '#6b7280' }}>
        Code expires in 10 minutes
      </p>
    </div>
  )
}
