'use client'
import { Image, Trash2, Film, Play, ZoomIn } from 'lucide-react'
import type { Media } from '@koppiku/shared'

interface Props { items: Media[]; onDelete: (id: string) => void; onPreview: (item: Media) => void }

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function MediaGrid({ items, onDelete, onPreview }: Props) {
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
          <button
            className="relative w-full aspect-video block"
            onClick={() => onPreview(m)}
          >
            {m.type === 'image' ? (
              <img src={m.cdn_url} alt={m.name} className="w-full h-full object-cover" />
            ) : (
              <video src={m.cdn_url} muted className="w-full h-full object-cover" />
            )}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
              <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 rounded-full p-2.5 shadow-lg">
                {m.type === 'video'
                  ? <Play size={18} className="text-gray-800 fill-gray-800" />
                  : <ZoomIn size={18} className="text-gray-800" />}
              </div>
            </div>
          </button>
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
