import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { LayoutDashboard, Image, ListVideo, Calendar, Store, Monitor, Coffee, Users } from 'lucide-react'

const nav = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/media', label: 'Media', icon: Image },
  { href: '/playlists', label: 'Playlists', icon: ListVideo },
  { href: '/schedules', label: 'Schedules', icon: Calendar },
  { href: '/outlets', label: 'Outlets', icon: Store },
  { href: '/outlet-groups', label: 'Outlet Groups', icon: Users },
  { href: '/devices', label: 'Devices', icon: Monitor },
]

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="w-60 bg-stone-900 text-white flex flex-col fixed inset-y-0">
        <div className="px-5 py-5 border-b border-stone-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center">
              <Coffee size={16} className="text-white" />
            </div>
            <div>
              <p className="font-bold text-sm leading-tight">Koppiku CMS</p>
              <p className="text-stone-400 text-xs">Digital Signage</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {nav.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-stone-300 hover:bg-stone-800 hover:text-white transition-colors"
            >
              <Icon size={16} />
              {label}
            </Link>
          ))}
        </nav>

        <div className="px-4 py-4 border-t border-stone-800">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-amber-600 rounded-full flex items-center justify-center text-xs font-bold text-white">
              {user.email?.[0]?.toUpperCase()}
            </div>
            <p className="text-xs text-stone-400 truncate">{user.email}</p>
          </div>
        </div>
      </aside>

      <main className="flex-1 ml-60 p-8 min-h-screen">{children}</main>
    </div>
  )
}
