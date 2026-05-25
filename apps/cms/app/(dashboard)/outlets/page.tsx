import { createClient } from '@/lib/supabase/server'
import { createOutlet, deleteOutlet } from './actions'
import type { Outlet } from '@koppiku/shared'

export default async function OutletsPage() {
  const supabase = await createClient()
  const { data: outlets } = await supabase.from('outlets').select('*').order('name') as { data: Outlet[] | null }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Outlets</h1>
      </div>

      <form action={createOutlet} className="flex gap-3 bg-white p-4 rounded-xl shadow-sm">
        <input name="name" placeholder="Outlet name" required
          className="flex-1 border rounded-lg px-3 py-2 text-sm" />
        <input name="region" placeholder="Region (e.g. KL)" required
          className="w-32 border rounded-lg px-3 py-2 text-sm" />
        <button type="submit" className="bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium">
          Add Outlet
        </button>
      </form>

      <div className="bg-white rounded-xl shadow-sm divide-y">
        {(outlets ?? []).map((outlet) => (
          <div key={outlet.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="font-medium text-sm">{outlet.name}</p>
              <p className="text-xs text-gray-500">{outlet.region}</p>
            </div>
            <form action={deleteOutlet.bind(null, outlet.id)}>
              <button type="submit" className="text-xs text-red-500 hover:underline">Delete</button>
            </form>
          </div>
        ))}
        {!outlets?.length && <p className="px-4 py-6 text-sm text-gray-400">No outlets yet.</p>}
      </div>
    </div>
  )
}
