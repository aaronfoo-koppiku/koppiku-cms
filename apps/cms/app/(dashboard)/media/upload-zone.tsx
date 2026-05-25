'use client'
import { useRef } from 'react'

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
      onClick={() => inputRef.current?.click()}
      className="border-2 border-dashed border-gray-300 rounded-xl p-10 text-center cursor-pointer hover:border-amber-400 transition"
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
      {uploading ? (
        <p className="text-sm text-gray-500">Uploading...</p>
      ) : (
        <p className="text-sm text-gray-500">Drop images or videos here, or click to browse</p>
      )}
    </div>
  )
}
