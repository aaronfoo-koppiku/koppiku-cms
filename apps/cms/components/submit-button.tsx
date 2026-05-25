'use client'
import { useFormStatus } from 'react-dom'
import { Loader2 } from 'lucide-react'

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode
  pendingLabel?: string
}

export function SubmitButton({ children, pendingLabel, className = '', disabled, ...props }: Props) {
  const { pending } = useFormStatus()
  const busy = pending || disabled

  return (
    <button type="submit" disabled={busy}
      className={`${className} disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-1.5`}
      {...props}
    >
      {pending
        ? <><Loader2 size={14} className="animate-spin" />{pendingLabel ?? children}</>
        : children}
    </button>
  )
}
