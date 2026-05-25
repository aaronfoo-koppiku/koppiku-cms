'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, X, CheckCircle2, Clock, Plus, Loader2 } from 'lucide-react'
import type { Playlist, PlaylistItem, Media } from '@koppiku/shared'
import { updateItemsSequence, removeItemFromPlaylist, addItemToPlaylist, publishPlaylist, unpublishPlaylist, updateItemDuration } from '../actions'

function SortableItem({ item, playlistId, onRemove }: {
  item: PlaylistItem & { media: Media }
  playlistId: string
  onRemove: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.id })
  const style = { transform: CSS.Transform.toString(transform), transition }
  const DEFAULT_DURATION = item.media.type === 'video' ? (item.media.duration_s ?? 30) : 10

  return (
    <div ref={setNodeRef} style={style}
      className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl p-3 group">
      <button {...attributes} {...listeners}
        className="cursor-grab text-gray-300 hover:text-gray-400 active:cursor-grabbing p-0.5">
        <GripVertical size={16} />
      </button>
      {item.media.type === 'image' ? (
        <img src={item.media.cdn_url} className="w-20 h-12 object-cover rounded-lg" alt={item.media.name} />
      ) : (
        <video src={item.media.cdn_url} className="w-20 h-12 object-cover rounded-lg" muted />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{item.media.name}</p>
        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${item.media.type === 'video' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>
          {item.media.type}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <Clock size={12} className="text-gray-400" />
        <input
          type="number" min={1} max={300}
          defaultValue={item.display_duration_s ?? DEFAULT_DURATION}
          onBlur={e => updateItemDuration(item.id, Number(e.target.value), playlistId)}
          className="w-14 border border-gray-200 rounded-lg px-2 py-1 text-xs text-center focus:outline-none focus:border-amber-400 transition-colors"
        />
        <span className="text-xs text-gray-400">s</span>
      </div>
      <button onClick={onRemove}
        className="text-gray-300 hover:text-red-500 p-1 rounded-lg hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100">
        <X size={15} />
      </button>
    </div>
  )
}

interface Props {
  playlist: Playlist
  items: (PlaylistItem & { media: Media })[]
  allMedia: Media[]
}

export function PlaylistEditor({ playlist, items: initial, allMedia }: Props) {
  const router = useRouter()
  const [items, setItems] = useState(initial)
  const [status, setStatus] = useState(playlist.status)
  const [publishing, setPublishing] = useState(false)
  const [addingId, setAddingId] = useState<string | null>(null)

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = items.findIndex(i => i.id === active.id)
    const newIndex = items.findIndex(i => i.id === over.id)
    const reordered = arrayMove(items, oldIndex, newIndex).map((item, idx) => ({ ...item, sequence: idx }))
    setItems(reordered)
    await updateItemsSequence(reordered.map(i => ({ id: i.id, sequence: i.sequence })))
  }

  async function handlePublish() {
    setPublishing(true)
    await publishPlaylist(playlist.id)
    setStatus('published')
    router.refresh()
    setPublishing(false)
  }

  async function handleUnpublish() {
    setPublishing(true)
    await unpublishPlaylist(playlist.id)
    setStatus('draft')
    router.refresh()
    setPublishing(false)
  }

  async function handleRemoveItem(itemId: string) {
    setItems(prev => prev.filter(i => i.id !== itemId))
    await removeItemFromPlaylist(itemId, playlist.id)
  }

  async function handleAddMedia(mediaId: string) {
    setAddingId(mediaId)
    const newItem = await addItemToPlaylist(playlist.id, mediaId, items.length)
    if (newItem) setItems(prev => [...prev, newItem as any])
    setAddingId(null)
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{playlist.name}</h1>
          <p className="text-gray-500 text-sm mt-1">{items.length} items in playlist</p>
        </div>
        <button
          onClick={status === 'draft' ? handlePublish : handleUnpublish}
          disabled={publishing}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50 ${
            status === 'draft'
              ? 'bg-green-500 hover:bg-green-400 text-white'
              : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
          }`}
        >
          {publishing
            ? <><Loader2 size={14} className="animate-spin" /> {status === 'draft' ? 'Publishing...' : 'Unpublishing...'}</>
            : status === 'draft'
              ? <><CheckCircle2 size={14} /> Publish</>
              : 'Unpublish'
          }
        </button>
      </div>

      <div>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Playlist items</h2>
        <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {items.map(item => <SortableItem key={item.id} item={item} playlistId={playlist.id} onRemove={() => handleRemoveItem(item.id)} />)}
              {!items.length && (
                <div className="border-2 border-dashed border-gray-200 rounded-xl py-12 flex flex-col items-center text-center">
                  <Plus size={24} className="text-gray-300 mb-2" />
                  <p className="text-sm text-gray-400">No items yet</p>
                  <p className="text-xs text-gray-400 mt-1">Add media from the library below</p>
                </div>
              )}
            </div>
          </SortableContext>
        </DndContext>
      </div>

      <div>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Add from media library</h2>
        <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
          {allMedia.map(m => (
            <button key={m.id}
              onClick={() => handleAddMedia(m.id)}
              disabled={addingId === m.id}
              className="text-left bg-white border border-gray-200 rounded-xl overflow-hidden hover:border-amber-400 hover:shadow-sm transition-all disabled:opacity-50 relative">
              {m.type === 'image'
                ? <img src={m.cdn_url} className="w-full aspect-video object-cover" alt={m.name} />
                : <video src={m.cdn_url} className="w-full aspect-video object-cover" muted />}
              {addingId === m.id && (
                <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
                  <Loader2 size={16} className="animate-spin text-amber-500" />
                </div>
              )}
              <p className="text-xs p-2 truncate text-gray-600">{m.name}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
