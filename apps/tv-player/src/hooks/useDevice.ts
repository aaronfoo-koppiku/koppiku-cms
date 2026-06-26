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
  const [deviceId] = useState(getOrCreateDeviceId)
  const [pairingCode, setPairingCode] = useState<string | null>(null)
  const [expiresAt, setExpiresAt] = useState<Date | null>(null)
  const [outletId, setOutletId] = useState<string | null>(
    () => localStorage.getItem('koppiku_outlet_id')
  )

  useEffect(() => {
    let cancelled = false

    async function init() {
      const { data } = await supabase
        .from('devices')
        .select('id, outlet_id, status, pairing_code, pairing_code_expires_at')
        .eq('id', deviceId)
        .single()

      if (cancelled) return

      if (!data) {
        const code = generatePairingCode()
        const { data: inserted } = await supabase.from('devices').insert({
          id: deviceId,
          pairing_code: code,
          ua: navigator.userAgent,
        }).select().single()
        if (cancelled) return
        if (inserted) {
          setPairingCode(inserted.pairing_code)
          if (inserted.pairing_code_expires_at) {
            setExpiresAt(new Date(inserted.pairing_code_expires_at))
          }
        }
      } else if (data.status === 'active' && data.outlet_id) {
        localStorage.setItem('koppiku_outlet_id', data.outlet_id)
        setOutletId(data.outlet_id)
      } else if (data.status === 'pending') {
        const exp = new Date(data.pairing_code_expires_at)
        if (exp <= new Date()) {
          const newCode = generatePairingCode()
          const newExpiry = new Date(Date.now() + HOUR_MS)
          const { error } = await supabase.from('devices').update({
            pairing_code: newCode,
            pairing_code_expires_at: newExpiry.toISOString(),
          }).eq('id', deviceId)
          if (cancelled) return
          if (!error) {
            setPairingCode(newCode)
            setExpiresAt(newExpiry)
          }
        } else {
          setPairingCode(data.pairing_code)
          setExpiresAt(exp)
        }
      }
    }

    init()
    return () => { cancelled = true }
  }, [deviceId])

  // Poll every 10s while unpaired — fallback in case the Realtime pairing event is missed
  useEffect(() => {
    if (outletId) return
    const id = setInterval(async () => {
      const { data } = await supabase
        .from('devices')
        .select('outlet_id, status')
        .eq('id', deviceId)
        .single()
      if (data?.status === 'active' && data.outlet_id) {
        localStorage.setItem('koppiku_outlet_id', data.outlet_id)
        setOutletId(data.outlet_id)
      }
    }, 10_000)
    return () => clearInterval(id)
  }, [deviceId, outletId])

  useEffect(() => {
    const channel = supabase
      .channel(`device:${deviceId}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'devices',
        filter: `id=eq.${deviceId}`,
      }, (payload) => {
        const updated = payload.new as { outlet_id: string | null; status: string; pairing_code: string; pairing_code_expires_at: string }
        if (updated.status === 'active' && updated.outlet_id) {
          localStorage.setItem('koppiku_outlet_id', updated.outlet_id)
          setOutletId(updated.outlet_id)
        } else if (updated.status === 'pending') {
          localStorage.removeItem('koppiku_outlet_id')
          setOutletId(null)
          setPairingCode(updated.pairing_code)
          setExpiresAt(updated.pairing_code_expires_at ? new Date(updated.pairing_code_expires_at) : null)
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [deviceId])

  return { deviceId, pairingCode, expiresAt, outletId }
}
