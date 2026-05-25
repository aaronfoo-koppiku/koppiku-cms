import { useState, useEffect, useCallback, useRef } from 'react'
import type { PlaylistItem, Media } from '@koppiku/shared'

export const DEFAULT_IMAGE_DURATION_S = 10

export function getActiveItems(items: (PlaylistItem & { media: Media })[]) {
  return [...items]
    .sort((a, b) => a.sequence - b.sequence)
    .map(item => ({
      ...item,
      display_duration_s:
        item.display_duration_s ??
        (item.media.type === 'video' ? (item.media.duration_s ?? 30) : DEFAULT_IMAGE_DURATION_S),
    }))
}

export function usePlayback(items: (PlaylistItem & { media: Media })[]) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const activeItems = getActiveItems(items)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()

  const advanceSlide = useCallback(() => {
    setCurrentIndex(i => (i + 1) % Math.max(activeItems.length, 1))
  }, [activeItems.length])

  const currentItem = activeItems[currentIndex] ?? null

  useEffect(() => {
    if (!currentItem || currentItem.media.type === 'video') return
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(advanceSlide, currentItem.display_duration_s * 1000)
    return () => clearTimeout(timerRef.current)
  }, [currentIndex, currentItem, advanceSlide])

  useEffect(() => {
    if (currentIndex >= activeItems.length && activeItems.length > 0) {
      setCurrentIndex(0)
    }
  }, [activeItems.length, currentIndex])

  return { currentItem, currentIndex, advanceSlide }
}
