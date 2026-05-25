'use client'
import { useEffect } from 'react'
import { X, Download, Film, Image as ImageIcon } from 'lucide-react'
import type { Media } from '@koppiku/shared'

interface Props {
  item: Media
  onClose: () => void
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function MediaPreviewModal({ item, onClose }: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl overflow-hidden shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
          <div className="flex items-center gap-2.5 min-w-0">
            {item.type === 'video'
              ? <Film size={16} className="text-blue-500 shrink-0" />
              : <ImageIcon size={16} className="text-purple-500 shrink-0" />}
            <span className="text-sm font-medium text-gray-900 truncate">{item.name}</span>
            {item.size_bytes ? (
              <span className="text-xs text-gray-400 shrink-0">{formatBytes(item.size_bytes)}</span>
            ) : null}
          </div>
          <div className="flex items-center gap-1.5 ml-4 shrink-0">
            <a
              href={item.cdn_url}
              download={item.name}
              target="_blank"
              rel="noreferrer"
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              title="Download"
            >
              <Download size={15} />
            </a>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Preview */}
        <div className="flex-1 overflow-auto bg-gray-950 flex items-center justify-center min-h-0">
          {item.type === 'image' ? (
            <img
              src={item.cdn_url}
              alt={item.name}
              className="max-w-full max-h-[70vh] object-contain"
            />
          ) : (
            <video
              src={item.cdn_url}
              controls
              autoPlay
              className="max-w-full max-h-[70vh]"
            />
          )}
        </div>
      </div>
    </div>
  )
}
