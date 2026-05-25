import type { PlaylistItem, Media } from '@koppiku/shared'

export function useRealtime(_outletId: string): { items: (PlaylistItem & { media: Media })[]; isOffline: boolean } {
  return { items: [], isOffline: false }
}
