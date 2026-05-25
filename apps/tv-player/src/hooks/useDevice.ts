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

const HOUR_MS = 60 * 60 * 1000

export function useDevice() {
  const deviceId = getOrCreateDeviceId()
  const [pairingCode, setPairingCode] = useState(generatePairingCode)
  const [expiresAt, setExpiresAt] = useState<Date | null>(null)
  const [outletId, setOutletId] = useState<string | null>(
    () => localStorage.getItem('koppiku_outlet_id')
  )

  useEffect(() => {
    supabase
      .from('devices')
      .select('id, outlet_id, status, pairing_code, pairing_code_expires_at')
      .eq('id', deviceId)
      .single()
      .then(async ({ data }) => {
        if (!data) {
          const { data: inserted } = await supabase.from('devices').insert({
            id: deviceId,
            pairing_code: pairingCode,
            ua: navigator.userAgent,
          }).select().single()
          if (inserted?.pairing_code_expires_at) {
            setExpiresAt(new Date(inserted.pairing_code_expires_at))
          }
        } else if (data.status === 'active' && data.outlet_id) {
          localStorage.setItem('koppiku_outlet_id', data.outlet_id)
          setOutletId(data.outlet_id)
        } else if (data.status === 'pending') {
          const exp = new Date(data.pairing_code_expires_at)
          if (exp <= new Date()) {
            // Code expired — generate a fresh one
            const newCode = generatePairingCode()
            const newExpiry = new Date(Date.now() + HOUR_MS)
            await supabase.from('devices').update({
              pairing_code: newCode,
              pairing_code_expires_at: newExpiry.toISOString(),
            }).eq('id', deviceId)
            setPairingCode(newCode)
            setExpiresAt(newExpiry)
          } else {
            setPairingCode(data.pairing_code)
            setExpiresAt(exp)
          }
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

  return { deviceId, pairingCode, expiresAt, outletId }
}
