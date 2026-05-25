'use client'
import { useFormStatus } from 'react-dom'
import { Trash2, Loader2 } from 'lucide-react'

export function DeleteButton({ className = '' }: { className?: string }) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending}
      className={`${className} p-1.5 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed`}>
      {pending
        ? <Loader2 size={15} className="animate-spin text-gray-400" />
        : <Trash2 size={15} />}
    </button>
  )
}
