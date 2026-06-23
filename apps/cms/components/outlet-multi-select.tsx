'use client'
import { useState } from 'react'
import { Search, Check } from 'lucide-react'

interface Props {
  outlets: { id: string; name: string }[]
  selected: string[]
  onChange: (ids: string[]) => void
}

export function OutletMultiSelect({ outlets, selected, onChange }: Props) {
  const [search, setSearch] = useState('')
  const filtered = outlets.filter(o =>
    o.name.toLowerCase().includes(search.toLowerCase())
  )

  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id])
  }

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="p-2 border-b border-gray-100">
        <div className="flex items-center gap-2 px-2.5 py-1.5 bg-gray-50 rounded-md">
          <Search size={13} className="text-gray-400 flex-shrink-0" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search outlets…"
            className="flex-1 text-sm bg-transparent text-gray-900 placeholder:text-gray-400 focus:outline-none"
          />
        </div>
      </div>
      <div className="max-h-44 overflow-y-auto">
        {filtered.map(outlet => {
          const isSelected = selected.includes(outlet.id)
          return (
            <button
              key={outlet.id}
              type="button"
              onClick={() => toggle(outlet.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                isSelected ? 'bg-amber-50 hover:bg-amber-100' : 'hover:bg-gray-50'
              }`}
            >
              <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                isSelected ? 'bg-amber-500 border-amber-500' : 'border-gray-300'
              }`}>
                {isSelected && <Check size={10} className="text-white" />}
              </div>
              <span className={`text-sm ${isSelected ? 'text-amber-800 font-medium' : 'text-gray-700'}`}>
                {outlet.name}
              </span>
            </button>
          )
        })}
        {!filtered.length && (
          <p className="text-center text-xs text-gray-400 py-6">No outlets match</p>
        )}
      </div>
      {selected.length > 0 && (
        <div className="px-3 py-2 border-t border-gray-100 bg-gray-50">
          <p className="text-xs text-amber-600 font-medium">
            {selected.length} outlet{selected.length !== 1 ? 's' : ''} selected
          </p>
        </div>
      )}
    </div>
  )
}
