import { createClient } from '@/lib/supabase/server'
import { createOutlet } from './actions'
import type { Outlet } from '@koppiku/shared'
import { SubmitButton } from '@/components/submit-button'
import { OutletsList } from './outlets-list'

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
          <SubmitButton className="bg-amber-500 hover:bg-amber-400 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            Add Outlet
          </SubmitButton>
        </form>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <OutletsList outlets={outlets ?? []} />
      </div>
    </div>
  )
}
