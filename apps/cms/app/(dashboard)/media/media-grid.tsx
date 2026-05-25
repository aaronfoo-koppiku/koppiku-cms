'use client'
import { Image, Trash2, Film } from 'lucide-react'
import type { Media } from '@koppiku/shared'

interface Props { items: Media[]; onDelete: (id: string) => void }

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function MediaGrid({ items, onDelete }: Props) {
  if (!items.length) return (
    <div className="flex flex-col items-center justify-center py-16 text-center bg-white border border-gray-200 rounded-xl">
      <Image size={32} className="text-gray-300 mb-3" />
      <p className="text-sm font-medium text-gray-500">No media yet</p>
      <p className="text-xs text-gray-400 mt-1">Upload your first image or video above</p>
    </div>
  )

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
      {items.map((m) => (
        <div key={m.id} className="group relative bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow">
          {m.type === 'image' ? (
            <img src={m.cdn_url} alt={m.name} className="w-full aspect-video object-cover" />
          ) : (
            <video src={m.cdn_url} muted className="w-full aspect-video object-cover" />
          )}
          <div className="p-2.5">
            <p className="text-xs font-medium text-gray-900 truncate">{m.name}</p>
            <div className="flex items-center gap-1.5 mt-1">
              {m.type === 'video'
                ? <Film size={11} className="text-blue-400" />
                : <Image size={11} className="text-purple-400" />}
              <p className="text-xs text-gray-400">{m.type} · {m.size_bytes ? formatBytes(m.size_bytes) : ''}</p>
            </div>
          </div>
          <button
            onClick={() => onDelete(m.id)}
            className="absolute top-2 right-2 bg-white/90 text-red-500 border border-red-100 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50"
          >
            <Trash2 size={13} />
          </button>
        </div>
      ))}
    </div>
  )
}
