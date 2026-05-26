import { useEffect } from 'react'

const INTERVAL_MS = 30_000

export function useHeartbeat(deviceId: string) {
  useEffect(() => {
    async function beat() {
      try {
        await fetch(import.meta.env.VITE_HEARTBEAT_URL, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ device_id: deviceId }),
        })
      } catch { /* ignore — offline */ }
    }

    beat()
    const interval = setInterval(beat, INTERVAL_MS)
    return () => clearInterval(interval)
  }, [deviceId])
}
