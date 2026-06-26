'use client'
import { useState } from 'react'
import { RefreshCw, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export function ForceRefreshButton() {
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle')

  async function handleClick() {
    setState('sending')
    const supabase = createClient()
    await supabase.channel('cms-control').send({
      type: 'broadcast',
      event: 'refresh',
      payload: { at: Date.now() },
    })
    setState('done')
    setTimeout(() => setState('idle'), 2500)
  }

  return (
    <button
      onClick={handleClick}
      disabled={state === 'sending'}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
        state === 'done'
          ? 'bg-green-500 text-white'
          : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300'
      } disabled:opacity-60`}
    >
      <RefreshCw size={14} className={state === 'sending' ? 'animate-spin' : ''} />
      {state === 'done' ? 'Sent!' : state === 'sending' ? 'Sending…' : 'Refresh all TVs'}
    </button>
  )
}

export function ClearCacheButton() {
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle')

  async function handleClick() {
    setState('sending')
    const supabase = createClient()
    await supabase.channel('cms-control').send({
      type: 'broadcast',
      event: 'clear-cache',
      payload: { at: Date.now() },
    })
    setState('done')
    setTimeout(() => setState('idle'), 2500)
  }

  return (
    <button
      onClick={handleClick}
      disabled={state === 'sending'}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
        state === 'done'
          ? 'bg-green-500 text-white'
          : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300'
      } disabled:opacity-60`}
    >
      <Trash2 size={14} />
      {state === 'done' ? 'Sent!' : state === 'sending' ? 'Sending…' : 'Clear TV cache'}
    </button>
  )
}
