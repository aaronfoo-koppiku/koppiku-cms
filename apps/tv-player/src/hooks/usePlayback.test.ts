import { describe, it, expect } from 'vitest'
import { getActiveItems, DEFAULT_IMAGE_DURATION_S } from './usePlayback'
import type { PlaylistItem, Media } from '@koppiku/shared'

function makeItem(id: string, duration?: number, type: 'image' | 'video' = 'image', videoDuration?: number): PlaylistItem & { media: Media } {
  return {
    id, playlist_id: 'p1', media_id: id, sequence: 0, display_duration_s: duration ?? null,
    media: {
      id, name: 'test', type, mime_type: type === 'image' ? 'image/jpeg' : 'video/mp4',
      gcs_url: '', cdn_url: 'http://cdn/item',
      thumbnail_url: null, duration_s: videoDuration ?? null, size_bytes: 0,
      uploaded_by: null, created_at: '',
    },
  }
}

describe('getActiveItems', () => {
  it('returns items sorted by sequence', () => {
    const items = [
      { ...makeItem('b'), sequence: 1 },
      { ...makeItem('a'), sequence: 0 },
    ]
    const result = getActiveItems(items)
    expect(result[0].id).toBe('a')
    expect(result[1].id).toBe('b')
  })

  it('uses DEFAULT_IMAGE_DURATION_S for images with no override', () => {
    const item = makeItem('x')
    const result = getActiveItems([item])
    expect(result[0].display_duration_s).toBe(DEFAULT_IMAGE_DURATION_S)
  })

  it('uses video duration for videos with no override', () => {
    const item = makeItem('v', undefined, 'video', 45)
    const result = getActiveItems([item])
    expect(result[0].display_duration_s).toBe(45)
  })

  it('respects display_duration_s override', () => {
    const item = makeItem('x', 25)
    const result = getActiveItems([item])
    expect(result[0].display_duration_s).toBe(25)
  })
})
