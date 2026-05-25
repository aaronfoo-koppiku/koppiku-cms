import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

const nav = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/media', label: 'Media' },
  { href: '/playlists', label: 'Playlists' },
  { href: '/schedules', label: 'Schedules' },
  { href: '/outlets', label: 'Outlets' },
  { href: '/devices', label: 'Devices' },
]

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 bg-amber-900 text-white flex flex-col">
        <div className="p-4 font-bold text-lg border-b border-amber-800">
          Koppiku CMS
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {nav.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="block px-3 py-2 rounded-lg text-sm hover:bg-amber-800 transition"
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="p-3 text-xs text-amber-300">{user.email}</div>
      </aside>
      <main className="flex-1 p-6 bg-gray-50">{children}</main>
    </div>
  )
}
