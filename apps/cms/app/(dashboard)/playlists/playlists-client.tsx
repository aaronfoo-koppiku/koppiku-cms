'use client'
import { useState, useTransition, useRef, useEffect } from 'react'
import Link from 'next/link'
import { ListVideo, ChevronRight, Pencil, Trash2, X, Check, Loader2 } from 'lucide-react'
import { deletePlaylist, renamePlaylist } from './actions'

type PlaylistRow = {
  id: string
  name: string
  status: string
  playlist_items?: { count: number }[]
}

export function PlaylistsClient({ playlists }: { playlists: PlaylistRow[] }) {
  const [items, setItems] = useState(playlists)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editingId) inputRef.current?.focus()
  }, [editingId])

  function startEdit(p: PlaylistRow, e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setEditingId(p.id)
    setEditName(p.name)
  }

  function commitRename(id: string) {
    const trimmed = editName.trim()
    if (!trimmed) { setEditingId(null); return }
    setItems(prev => prev.map(p => p.id === id ? { ...p, name: trimmed } : p))
    setEditingId(null)
    startTransition(() => renamePlaylist(id, trimmed))
  }

  function handleDelete(id: string, e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setDeletingId(id)
    setItems(prev => prev.filter(p => p.id !== id))
    startTransition(async () => {
      await deletePlaylist(id)
      setDeletingId(null)
    })
  }

  if (!items.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <ListVideo size={32} className="text-gray-300 mb-3" />
        <p className="text-sm font-medium text-gray-500">No playlists yet</p>
        <p className="text-xs text-gray-400 mt-1">Create your first playlist above</p>
      </div>
    )
  }

  return (
    <>
      {items.map((p, i) => (
        <div key={p.id}
          className={`flex items-center gap-3 px-5 py-4 hover:bg-gray-50 transition-colors group ${i > 0 ? 'border-t border-gray-100' : ''}`}>

          <div className="w-9 h-9 bg-amber-50 rounded-lg flex items-center justify-center shrink-0">
            <ListVideo size={16} className="text-amber-600" />
          </div>

          {editingId === p.id ? (
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <input
                ref={inputRef}
                value={editName}
                onChange={e => setEditName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') commitRename(p.id)
                  if (e.key === 'Escape') setEditingId(null)
                }}
                className="flex-1 min-w-0 border border-amber-400 rounded-lg px-2.5 py-1 text-sm text-gray-900 focus:outline-none"
              />
              <button onClick={() => commitRename(p.id)}
                className="p-1 rounded-lg text-green-600 hover:bg-green-50 transition-colors shrink-0">
                <Check size={14} />
              </button>
              <button onClick={() => setEditingId(null)}
                className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors shrink-0">
                <X size={14} />
              </button>
            </div>
          ) : (
            <Link href={`/playlists/${p.id}`} className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900">{p.name}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {p.playlist_items?.[0]?.count ?? 0} items
              </p>
            </Link>
          )}

          {editingId !== p.id && (
            <div className="flex items-center gap-1.5 shrink-0">
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${p.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                {p.status}
              </span>
              <button
                onClick={e => startEdit(p, e)}
                title="Rename"
                className="p-1.5 rounded-lg text-gray-300 hover:text-gray-600 hover:bg-gray-100 transition-colors opacity-0 group-hover:opacity-100"
              >
                <Pencil size={13} />
              </button>
              <button
                onClick={e => handleDelete(p.id, e)}
                disabled={deletingId === p.id || isPending}
                title="Delete"
                className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-60"
              >
                {deletingId === p.id
                  ? <Loader2 size={13} className="animate-spin text-red-400" />
                  : <Trash2 size={13} />}
              </button>
              <ChevronRight size={16} className="text-gray-300 group-hover:text-gray-400 transition-colors" />
            </div>
          )}
        </div>
      ))}
    </>
  )
}
