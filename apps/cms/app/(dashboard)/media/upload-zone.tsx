'use client'
import { useRef } from 'react'
import { Upload, Loader2 } from 'lucide-react'

interface Props { onFiles: (files: File[]) => void; uploading: boolean }

export function UploadZone({ onFiles, uploading }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) onFiles(Array.from(e.target.files))
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const files = Array.from(e.dataTransfer.files).filter(
      f => f.type.startsWith('image/') || f.type.startsWith('video/')
    )
    if (files.length) onFiles(files)
  }

  return (
    <div
      onDrop={handleDrop}
      onDragOver={e => e.preventDefault()}
      onClick={() => !uploading && inputRef.current?.click()}
      className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors ${
        uploading
          ? 'border-amber-300 bg-amber-50 cursor-default'
          : 'border-gray-200 hover:border-amber-400 hover:bg-amber-50/50 cursor-pointer'
      }`}
    >
      <input
        ref={inputRef}
        data-testid="file-input"
        type="file"
        accept="image/*,video/*"
        multiple
        className="hidden"
        onChange={handleChange}
      />
      <div className="flex flex-col items-center gap-2">
        {uploading ? (
          <>
            <Loader2 size={24} className="text-amber-500 animate-spin" />
            <p className="text-sm font-medium text-amber-600">Uploading to GCS...</p>
          </>
        ) : (
          <>
            <Upload size={24} className="text-gray-400" />
            <div>
              <p className="text-sm font-medium text-gray-700">Drop files here or click to browse</p>
              <p className="text-xs text-gray-400 mt-0.5">Images and videos supported</p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
