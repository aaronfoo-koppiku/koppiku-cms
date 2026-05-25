'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { UploadZone } from './upload-zone'
import { MediaGrid } from './media-grid'
import type { Media } from '@koppiku/shared'

export default function MediaPage() {
  const [items, setItems] = useState<Media[]>([])
  const [uploading, setUploading] = useState(false)
  const supabase = createClient()

  const loadMedia = useCallback(async () => {
    const { data } = await supabase.from('media').select('*').order('created_at', { ascending: false })
    setItems((data as Media[]) ?? [])
  }, [supabase])

  useEffect(() => { loadMedia() }, [loadMedia])

  async function handleFiles(files: File[]) {
    setUploading(true)
    const { data: { session } } = await supabase.auth.getSession()
    for (const file of files) {
      await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/upload`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${session!.access_token}`,
          'x-file-name': file.name,
          'x-file-type': file.type,
        },
        body: file,
      })
    }
    setUploading(false)
    loadMedia()
  }

  async function handleDelete(id: string) {
    setItems(prev => prev.filter(m => m.id !== id))
    await supabase.from('media').delete().eq('id', id)
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Media Library</h1>
      <UploadZone onFiles={handleFiles} uploading={uploading} />
      <MediaGrid items={items} onDelete={handleDelete} />
    </div>
  )
}
