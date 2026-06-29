'use client'
import { useState, useRef } from 'react'
import { Store, MapPin, Pencil, Check, X, Loader2 } from 'lucide-react'
import { DeleteButton } from '@/components/delete-button'
import { deleteOutlet, renameOutlet } from './actions'
import type { Outlet } from '@koppiku/shared'

function OutletRow({ outlet, isFirst }: { outlet: Outlet; isFirst: boolean }) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState(outlet.name)
  const [region, setRegion] = useState(outlet.region ?? '')
  const [displayName, setDisplayName] = useState(outlet.name)
  const [displayRegion, setDisplayRegion] = useState(outlet.region ?? '')
  const nameRef = useRef<HTMLInputElement>(null)

  function startEdit() {
    setName(displayName)
    setRegion(displayRegion)
    setEditing(true)
    setTimeout(() => nameRef.current?.focus(), 0)
  }

  async function save() {
    const trimmedName = name.trim()
    if (!trimmedName) { cancel(); return }
    setSaving(true)
    await renameOutlet(outlet.id, trimmedName, region.trim())
    setDisplayName(trimmedName)
    setDisplayRegion(region.trim())
    setSaving(false)
    setEditing(false)
  }

  function cancel() {
    setEditing(false)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') save()
    if (e.key === 'Escape') cancel()
  }

  return (
    <div className={`flex items-center justify-between px-5 py-4 ${!isFirst ? 'border-t border-gray-100' : ''}`}>
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center shrink-0">
          <Store size={16} className="text-blue-600" />
        </div>

        {editing ? (
          <div className="flex items-center gap-2 flex-1 flex-wrap">
            <input
              ref={nameRef}
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Outlet name"
              className="border border-amber-400 rounded-lg px-2 py-1 text-sm font-medium text-gray-900 focus:outline-none w-48"
            />
            <input
              value={region}
              onChange={e => setRegion(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Region"
              className="border border-gray-200 rounded-lg px-2 py-1 text-sm text-gray-600 focus:outline-none focus:border-amber-400 w-28"
            />
            <div className="flex items-center gap-1">
              <button onClick={save} disabled={saving}
                className="p-1.5 rounded-lg text-green-600 hover:bg-green-50 transition-colors disabled:opacity-60">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              </button>
              <button onClick={cancel}
                className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors">
                <X size={14} />
              </button>
            </div>
          </div>
        ) : (
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 group/name">
              <p className="text-sm font-medium text-gray-900">{displayName}</p>
              <button onClick={startEdit}
                className="p-1 rounded text-gray-300 hover:text-amber-500 opacity-0 group-hover/name:opacity-100 transition-all">
                <Pencil size={12} />
              </button>
            </div>
            <div className="flex items-center gap-1 mt-0.5">
              <MapPin size={11} className="text-gray-400" />
              <p className="text-xs text-gray-500">{displayRegion || 'No region'}</p>
            </div>
          </div>
        )}
      </div>

      {!editing && (
        <form action={deleteOutlet.bind(null, outlet.id)}>
          <DeleteButton className="text-gray-400 hover:text-red-500 hover:bg-red-50" />
        </form>
      )}
    </div>
  )
}

export function OutletsList({ outlets }: { outlets: Outlet[] }) {
  if (!outlets.length) return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Store size={32} className="text-gray-300 mb-3" />
      <p className="text-sm font-medium text-gray-500">No outlets yet</p>
      <p className="text-xs text-gray-400 mt-1">Add your first Koppiku location above</p>
    </div>
  )

  return (
    <>
      {outlets.map((outlet, i) => (
        <OutletRow key={outlet.id} outlet={outlet} isFirst={i === 0} />
      ))}
    </>
  )
}
