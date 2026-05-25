'use client'
import type { Media } from '@koppiku/shared'

interface Props { items: Media[]; onDelete: (id: string) => void }

export function MediaGrid({ items, onDelete }: Props) {
  if (!items.length) return <p className="text-sm text-gray-400">No media yet.</p>
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
      {items.map((m) => (
        <div key={m.id} className="group relative bg-white rounded-xl overflow-hidden shadow-sm">
          {m.type === 'image' ? (
            <img src={m.cdn_url} alt={m.name} className="w-full aspect-video object-cover" />
          ) : (
            <video src={m.cdn_url} muted className="w-full aspect-video object-cover" />
          )}
          <div className="p-2">
            <p className="text-xs font-medium truncate">{m.name}</p>
            <p className="text-xs text-gray-400">{m.type}</p>
          </div>
          <button
            onClick={() => onDelete(m.id)}
            className="absolute top-2 right-2 bg-red-500 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition"
          >
            Delete
          </button>
        </div>
      ))}
    </div>
  )
}
