'use client'
import { useActionState } from 'react'
import { pairDevice } from './actions'
import { Loader2 } from 'lucide-react'

interface Props {
  outlets: { id: string; name: string }[]
}

export function PairDeviceForm({ outlets }: Props) {
  const [state, action, pending] = useActionState(pairDevice, null)

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <h2 className="text-sm font-semibold text-gray-700 mb-4">Pair a screen</h2>
      {state?.error && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-3 py-2.5 mb-4">
          {state.error}
        </div>
      )}
      {state && !state.error && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-3 py-2.5 mb-4">
          Device paired successfully.
        </div>
      )}
      <form action={action} className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-gray-600">Pairing code</label>
          <input name="pairing_code" placeholder="123456" maxLength={6} required
            className="w-32 border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono tracking-widest focus:outline-none focus:border-amber-400 transition-colors" />
        </div>
        {outlets.length > 0 && (
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-600">Outlet</label>
            <select name="outlet_id"
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-400 transition-colors">
              <option value="">No outlet</option>
              {outlets.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </div>
        )}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-gray-600">Device name</label>
          <input name="device_name" placeholder="Screen 1"
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-400 transition-colors" />
        </div>
        <button type="submit" disabled={pending}
          className="bg-amber-500 hover:bg-amber-400 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2">
          {pending && <Loader2 size={14} className="animate-spin" />}
          Pair Device
        </button>
      </form>
    </div>
  )
}
