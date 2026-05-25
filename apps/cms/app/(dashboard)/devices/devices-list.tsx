'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Monitor, Wifi, WifiOff, Pencil, Check, X, Copy, KeyRound, Loader2 } from 'lucide-react'
import { renameDevice } from './actions'

type Device = {
  id: string
  name: string | null
  status: string
  last_seen: string | null
  pairing_code: string | null
  pairing_code_expires_at: string | null
  outlet: { name: string } | null
}

function isOnline(lastSeen: string | null): boolean {
  if (!lastSeen) return false
  return Date.now() - new Date(lastSeen).getTime() < 90_000
}

function timeAgo(ts: string | null): string {
  if (!ts) return 'Never'
  const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000)
  if (s < 10) return 'Just now'
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return new Date(ts).toLocaleDateString('en-MY')
}

function RenameField({ id, initial }: { id: string; initial: string | null }) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [value, setValue] = useState(initial ?? '')
  const inputRef = useRef<HTMLInputElement>(null)

  function startEdit() {
    setEditing(true)
    setTimeout(() => inputRef.current?.select(), 0)
  }

  async function save() {
    if (!value.trim()) { setEditing(false); return }
    setSaving(true)
    await renameDevice(id, value.trim())
    setSaving(false)
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1.5">
        <input
          ref={inputRef}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }}
          className="text-sm font-medium text-gray-900 border border-amber-400 rounded-md px-2 py-0.5 focus:outline-none w-40"
          autoFocus
        />
        <button onClick={save} disabled={saving} className="p-1 text-green-600 hover:bg-green-50 rounded disabled:opacity-60">
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
        </button>
        <button onClick={() => setEditing(false)} className="p-1 text-gray-400 hover:bg-gray-100 rounded">
          <X size={13} />
        </button>
      </div>
    )
  }

  return (
    <button onClick={startEdit} className="group/rename flex items-center gap-1.5">
      <span className="text-sm font-medium text-gray-900">{initial ?? 'Unnamed screen'}</span>
      <Pencil size={11} className="text-gray-300 group-hover/rename:text-amber-500 transition-colors" />
    </button>
  )
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <button onClick={copy} className="p-0.5 text-gray-300 hover:text-gray-500 transition-colors" title="Copy">
      {copied ? <Check size={11} className="text-green-500" /> : <Copy size={11} />}
    </button>
  )
}

interface Props {
  initialDevices: Device[]
}

export function DevicesList({ initialDevices }: Props) {
  const [devices, setDevices] = useState<Device[]>(initialDevices)
  const [, setTick] = useState(0)

  // Tick every 15s to keep "X ago" labels fresh
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 15_000)
    return () => clearInterval(id)
  }, [])

  // Realtime: update last_seen and status live
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('devices-live')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'devices' }, payload => {
        setDevices(prev => prev.map(d =>
          d.id === payload.new.id ? { ...d, ...payload.new } : d
        ))
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'devices' }, payload => {
        setDevices(prev => [...prev, payload.new as Device])
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  if (!devices.length) return (
    <div className="bg-white border border-gray-200 rounded-xl flex flex-col items-center justify-center py-16 text-center">
      <Monitor size={32} className="text-gray-300 mb-3" />
      <p className="text-sm font-medium text-gray-500">No devices yet</p>
      <p className="text-xs text-gray-400 mt-1">Pair a screen using the code shown on your TV</p>
    </div>
  )

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      {devices.map((d, i) => {
        const online = isOnline(d.last_seen)
        const isPending = d.status === 'pending'
        const codeExpired = d.pairing_code_expires_at
          ? new Date(d.pairing_code_expires_at) <= new Date()
          : true

        return (
          <div key={d.id} className={`px-5 py-4 ${i > 0 ? 'border-t border-gray-100' : ''}`}>
            <div className="flex items-start justify-between gap-4">
              {/* Left: icon + details */}
              <div className="flex items-start gap-3 min-w-0">
                <div className={`w-9 h-9 shrink-0 rounded-lg flex items-center justify-center mt-0.5 ${
                  isPending ? 'bg-amber-50' : online ? 'bg-green-50' : 'bg-gray-100'
                }`}>
                  <Monitor size={16} className={isPending ? 'text-amber-500' : online ? 'text-green-600' : 'text-gray-400'} />
                </div>

                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <RenameField id={d.id} initial={d.name} />
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      isPending ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
                    }`}>
                      {d.status}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
                    <span>{d.outlet?.name ?? 'No outlet'}</span>
                    <span className="text-gray-200">·</span>
                    <span>Last seen: {timeAgo(d.last_seen)}</span>
                    <span className="text-gray-200">·</span>
                    <span className="flex items-center gap-1 font-mono text-gray-400">
                      {d.id.slice(0, 8)}…
                      <CopyButton text={d.id} />
                    </span>
                  </div>

                  {isPending && d.pairing_code && (
                    <div className={`inline-flex items-center gap-2 mt-1.5 px-3 py-1.5 rounded-lg border ${
                      codeExpired
                        ? 'bg-gray-50 border-gray-200'
                        : 'bg-amber-50 border-amber-200'
                    }`}>
                      <KeyRound size={12} className={codeExpired ? 'text-gray-400' : 'text-amber-500'} />
                      <span className={`font-mono text-base font-bold tracking-widest ${
                        codeExpired ? 'text-gray-400 line-through' : 'text-amber-700'
                      }`}>
                        {d.pairing_code}
                      </span>
                      {codeExpired
                        ? <span className="text-xs text-gray-400">expired</span>
                        : <span className="text-xs text-amber-600">
                            expires {new Date(d.pairing_code_expires_at!).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                      }
                    </div>
                  )}
                </div>
              </div>

              {/* Right: online status */}
              <div className="flex items-center gap-1.5 text-xs shrink-0 mt-1">
                {isPending ? (
                  <span className="text-amber-500 font-medium">Waiting to pair</span>
                ) : online ? (
                  <><Wifi size={14} className="text-green-500" /><span className="text-green-600 font-medium">Online</span></>
                ) : (
                  <><WifiOff size={14} className="text-gray-400" /><span className="text-gray-400">Offline</span></>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
