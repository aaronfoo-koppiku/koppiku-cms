'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Monitor, Wifi, WifiOff, Pencil, Check, X, Copy, KeyRound, Loader2, Unlink, Play, Trash2, Eraser } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { renameDevice, unpairDevice, deleteDevice } from './actions'

type Device = {
  id: string
  name: string | null
  status: string
  last_seen: string | null
  pairing_code: string | null
  pairing_code_expires_at: string | null
  outlet: { id: string; name: string } | null
}

type ComputedStatus = 'online' | 'connecting' | 'offline' | 'pending'
type FilterStatus = 'all' | ComputedStatus

const STATUS_ORDER: Record<ComputedStatus, number> = { online: 0, connecting: 1, offline: 2, pending: 3 }

function isOnline(lastSeen: string | null): boolean {
  if (!lastSeen) return false
  return Date.now() - new Date(lastSeen).getTime() < 90_000
}

function getComputedStatus(d: Device): ComputedStatus {
  if (d.status === 'pending') return 'pending'
  if (!d.last_seen) return 'connecting'
  if (isOnline(d.last_seen)) return 'online'
  return 'offline'
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
  outletPlaylistMap: Record<string, { name: string; via?: string }>
}

export function DevicesList({ initialDevices, outletPlaylistMap }: Props) {
  const [devices, setDevices] = useState<Device[]>(initialDevices)
  const [, setTick] = useState(0)
  const [unpairing, setUnpairing] = useState<string | null>(null)
  const [confirmUnpair, setConfirmUnpair] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [clearingCache, setClearingCache] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterStatus>('all')

  // Tick every 15s to keep "X ago" labels and online status fresh
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

  async function handleUnpair(id: string) {
    setUnpairing(id)
    setConfirmUnpair(null)
    await unpairDevice(id)
    setUnpairing(null)
  }

  async function handleClearCache(deviceId: string, outletId: string) {
    setClearingCache(deviceId)
    const supabase = createClient()
    await supabase.channel('cms-control').send({
      type: 'broadcast',
      event: 'clear-cache',
      payload: { outlet_id: outletId, at: Date.now() },
    })
    setClearingCache(null)
  }

  async function handleDelete(id: string) {
    setDeleting(id)
    setConfirmDelete(null)
    await deleteDevice(id)
    setDevices(prev => prev.filter(d => d.id !== id))
    setDeleting(null)
  }

  // Sort: online → connecting → offline → pending, then alphabetical within each group
  const sorted = [...devices].sort((a, b) => {
    const diff = STATUS_ORDER[getComputedStatus(a)] - STATUS_ORDER[getComputedStatus(b)]
    if (diff !== 0) return diff
    return (a.name ?? '').localeCompare(b.name ?? '')
  })

  const counts: Record<ComputedStatus, number> = { online: 0, connecting: 0, offline: 0, pending: 0 }
  for (const d of devices) counts[getComputedStatus(d)]++

  const visible = filter === 'all' ? sorted : sorted.filter(d => getComputedStatus(d) === filter)

  const FILTERS: { key: FilterStatus; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'online', label: 'Online' },
    { key: 'connecting', label: 'Connecting' },
    { key: 'offline', label: 'Offline' },
    { key: 'pending', label: 'Pending' },
  ]

  if (!devices.length) return (
    <div className="bg-white border border-gray-200 rounded-xl flex flex-col items-center justify-center py-16 text-center">
      <Monitor size={32} className="text-gray-300 mb-3" />
      <p className="text-sm font-medium text-gray-500">No devices yet</p>
      <p className="text-xs text-gray-400 mt-1">Pair a screen using the code shown on your TV</p>
    </div>
  )

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      {/* Filter bar */}
      <div className="flex items-center gap-1.5 px-4 py-3 border-b border-gray-100 flex-wrap">
        {FILTERS.map(({ key, label }) => {
          const count = key === 'all' ? devices.length : counts[key as ComputedStatus]
          const active = filter === key
          return (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                active
                  ? 'bg-amber-500 text-white'
                  : count === 0
                    ? 'text-gray-300 cursor-default'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              disabled={count === 0 && key !== 'all'}
            >
              {label}
              <span className={`ml-1.5 ${active ? 'text-amber-100' : 'text-gray-400'}`}>
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {visible.length === 0 ? (
        <div className="py-12 flex flex-col items-center text-center">
          <p className="text-sm text-gray-400">No {filter} devices</p>
        </div>
      ) : (
        visible.map((d, i) => {
          const cs = getComputedStatus(d)
          const online = cs === 'online'
          const isPending = cs === 'pending'
          const isConnecting = cs === 'connecting'
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
                      {d.outlet?.id && outletPlaylistMap[d.outlet.id] && (
                        <>
                          <span className="text-gray-200">·</span>
                          <span className="flex items-center gap-1 text-amber-600 font-medium">
                            <Play size={10} className="fill-amber-500 shrink-0" />
                            {outletPlaylistMap[d.outlet.id].name}
                            {outletPlaylistMap[d.outlet.id].via && (
                              <span className="text-gray-400 font-normal">
                                ({outletPlaylistMap[d.outlet.id].via})
                              </span>
                            )}
                          </span>
                        </>
                      )}
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

                {/* Right: status + unpair */}
                <div className="flex flex-col items-end gap-2 shrink-0 mt-0.5">
                  <div className="flex items-center gap-1.5 text-xs">
                    {isPending ? (
                      <span className="text-amber-500 font-medium">Waiting to pair</span>
                    ) : isConnecting ? (
                      <><Loader2 size={14} className="animate-spin text-blue-400" /><span className="text-blue-500 font-medium">Connecting…</span></>
                    ) : online ? (
                      <><Wifi size={14} className="text-green-500" /><span className="text-green-600 font-medium">Online</span></>
                    ) : (
                      <><WifiOff size={14} className="text-gray-400" /><span className="text-gray-400">Offline</span></>
                    )}
                  </div>

                  {confirmDelete === d.id ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-gray-500">Delete permanently?</span>
                      <button
                        onClick={() => handleDelete(d.id)}
                        disabled={deleting === d.id}
                        className="text-xs px-2 py-0.5 rounded bg-red-500 text-white hover:bg-red-600 disabled:opacity-60 flex items-center gap-1"
                      >
                        {deleting === d.id ? <Loader2 size={11} className="animate-spin" /> : null}
                        Delete
                      </button>
                      <button
                        onClick={() => setConfirmDelete(null)}
                        className="text-xs px-2 py-0.5 rounded border border-gray-200 text-gray-500 hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : confirmUnpair === d.id ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-gray-500">Unpair?</span>
                      <button
                        onClick={() => handleUnpair(d.id)}
                        disabled={unpairing === d.id}
                        className="text-xs px-2 py-0.5 rounded bg-red-500 text-white hover:bg-red-600 disabled:opacity-60 flex items-center gap-1"
                      >
                        {unpairing === d.id ? <Loader2 size={11} className="animate-spin" /> : null}
                        Yes
                      </button>
                      <button
                        onClick={() => setConfirmUnpair(null)}
                        className="text-xs px-2 py-0.5 rounded border border-gray-200 text-gray-500 hover:bg-gray-50"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      {!isPending && d.outlet?.id && (
                        <button
                          onClick={() => handleClearCache(d.id, d.outlet!.id)}
                          disabled={clearingCache === d.id}
                          className="flex items-center gap-1 text-xs text-gray-400 hover:text-amber-500 transition-colors disabled:opacity-60"
                        >
                          {clearingCache === d.id
                            ? <Loader2 size={11} className="animate-spin" />
                            : <Eraser size={11} />}
                          Clear cache
                        </button>
                      )}
                      {!isPending && (
                        <button
                          onClick={() => { setConfirmUnpair(d.id); setConfirmDelete(null) }}
                          className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <Unlink size={11} />
                          Unpair
                        </button>
                      )}
                      <button
                        onClick={() => { setConfirmDelete(d.id); setConfirmUnpair(null) }}
                        className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={11} />
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
