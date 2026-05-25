'use client'
import { useState } from 'react'
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Playlist, PlaylistItem, Media } from '@koppiku/shared'
import { updateItemsSequence, removeItemFromPlaylist, addItemToPlaylist, publishPlaylist, unpublishPlaylist, updateItemDuration } from '../actions'

function SortableItem({ item, playlistId }: { item: PlaylistItem & { media: Media }; playlistId: string }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.id })
  const style = { transform: CSS.Transform.toString(transform), transition }
  const DEFAULT_DURATION = item.media.type === 'video' ? (item.media.duration_s ?? 30) : 10

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-3 bg-white border rounded-lg p-3">
      <span {...attributes} {...listeners} className="cursor-grab text-gray-400">⠿</span>
      {item.media.type === 'image' ? (
        <img src={item.media.cdn_url} className="w-16 h-10 object-cover rounded" alt={item.media.name} />
      ) : (
        <video src={item.media.cdn_url} className="w-16 h-10 object-cover rounded" muted />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{item.media.name}</p>
        <p className="text-xs text-gray-400">{item.media.type}</p>
      </div>
      <div className="flex items-center gap-1 text-xs">
        <input
          type="number" min={1} max={300}
          defaultValue={item.display_duration_s ?? DEFAULT_DURATION}
          onChange={e => updateItemDuration(item.id, Number(e.target.value), playlistId)}
          className="w-14 border rounded px-2 py-1 text-center"
        />
        <span className="text-gray-400">s</span>
      </div>
      <button onClick={() => removeItemFromPlaylist(item.id, playlistId)}
        className="text-red-400 hover:text-red-600 text-sm">✕</button>
    </div>
  )
}

interface Props {
  playlist: Playlist
  items: (PlaylistItem & { media: Media })[]
  allMedia: Media[]
}

export function PlaylistEditor({ playlist, items: initial, allMedia }: Props) {
  const [items, setItems] = useState(initial)

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = items.findIndex(i => i.id === active.id)
    const newIndex = items.findIndex(i => i.id === over.id)
    const reordered = arrayMove(items, oldIndex, newIndex).map((item, idx) => ({ ...item, sequence: idx }))
    setItems(reordered)
    await updateItemsSequence(reordered.map(i => ({ id: i.id, sequence: i.sequence })))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{playlist.name}</h1>
        {playlist.status === 'draft' ? (
          <button onClick={() => publishPlaylist(playlist.id)}
            className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium">
            Publish
          </button>
        ) : (
          <button onClick={() => unpublishPlaylist(playlist.id)}
            className="bg-gray-400 text-white px-4 py-2 rounded-lg text-sm font-medium">
            Unpublish
          </button>
        )}
      </div>

      <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {items.map(item => <SortableItem key={item.id} item={item} playlistId={playlist.id} />)}
            {!items.length && <p className="text-sm text-gray-400">No items yet. Add from media below.</p>}
          </div>
        </SortableContext>
      </DndContext>

      <div>
        <h2 className="font-semibold mb-3 text-sm text-gray-600 uppercase tracking-wide">Add from Media Library</h2>
        <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
          {allMedia.map(m => (
            <button key={m.id}
              onClick={() => addItemToPlaylist(playlist.id, m.id, items.length)}
              className="text-left bg-white rounded-lg overflow-hidden shadow-sm hover:ring-2 ring-amber-400">
              {m.type === 'image'
                ? <img src={m.cdn_url} className="w-full aspect-video object-cover" alt={m.name} />
                : <video src={m.cdn_url} className="w-full aspect-video object-cover" muted />}
              <p className="text-xs p-2 truncate">{m.name}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
