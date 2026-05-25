import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

function generatePairingCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}

function getOrCreateDeviceId(): string {
  const stored = localStorage.getItem('koppiku_device_id')
  if (stored) return stored
  const id = crypto.randomUUID()
  localStorage.setItem('koppiku_device_id', id)
  return id
}

export function useDevice() {
  const deviceId = getOrCreateDeviceId()
  const [pairingCode] = useState(generatePairingCode)
  const [outletId, setOutletId] = useState<string | null>(
    () => localStorage.getItem('koppiku_outlet_id')
  )

  useEffect(() => {
    supabase.from('devices').select('id, outlet_id, status').eq('id', deviceId).single()
      .then(({ data }) => {
        if (!data) {
          supabase.from('devices').insert({
            id: deviceId,
            pairing_code: pairingCode,
            ua: navigator.userAgent,
          })
        } else if (data.status === 'active' && data.outlet_id) {
          localStorage.setItem('koppiku_outlet_id', data.outlet_id)
          setOutletId(data.outlet_id)
        }
      })
  }, [deviceId, pairingCode])

  useEffect(() => {
    const channel = supabase
      .channel(`device:${deviceId}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'devices',
        filter: `id=eq.${deviceId}`,
      }, (payload) => {
        const updated = payload.new as { outlet_id: string | null; status: string }
        if (updated.status === 'active' && updated.outlet_id) {
          localStorage.setItem('koppiku_outlet_id', updated.outlet_id)
          setOutletId(updated.outlet_id)
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [deviceId])

  return { deviceId, pairingCode, outletId }
}
