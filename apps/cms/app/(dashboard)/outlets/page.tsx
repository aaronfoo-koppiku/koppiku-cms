import { createClient } from '@/lib/supabase/server'
import { createOutlet, deleteOutlet } from './actions'
import { Store, MapPin, Trash2 } from 'lucide-react'
import type { Outlet } from '@koppiku/shared'

export default async function OutletsPage() {
  const supabase = await createClient()
  const { data: outlets } = await supabase.from('outlets').select('*').order('name') as { data: Outlet[] | null }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Outlets</h1>
        <p className="text-gray-500 text-sm mt-1">Manage your Koppiku locations</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Add outlet</h2>
        <form action={createOutlet} className="flex gap-3">
          <input name="name" placeholder="Outlet name" required
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-amber-400 transition-colors" />
          <input name="region" placeholder="Region (e.g. KL)" required
            className="w-36 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-amber-400 transition-colors" />
          <button type="submit"
            className="bg-amber-500 hover:bg-amber-400 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            Add Outlet
          </button>
        </form>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {(outlets ?? []).map((outlet, i) => (
          <div key={outlet.id} className={`flex items-center justify-between px-5 py-4 ${i > 0 ? 'border-t border-gray-100' : ''}`}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center">
                <Store size={16} className="text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">{outlet.name}</p>
                <div className="flex items-center gap-1 mt-0.5">
                  <MapPin size={11} className="text-gray-400" />
                  <p className="text-xs text-gray-500">{outlet.region || 'No region'}</p>
                </div>
              </div>
            </div>
            <form action={deleteOutlet.bind(null, outlet.id)}>
              <button type="submit"
                className="text-gray-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 transition-colors">
                <Trash2 size={15} />
              </button>
            </form>
          </div>
        ))}
        {!outlets?.length && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Store size={32} className="text-gray-300 mb-3" />
            <p className="text-sm font-medium text-gray-500">No outlets yet</p>
            <p className="text-xs text-gray-400 mt-1">Add your first Koppiku location above</p>
          </div>
        )}
      </div>
    </div>
  )
}
