'use client'
import { useState, useTransition } from 'react'
import { createGroup, deleteGroup, renameGroup, setGroupMembers } from './actions'
import { Plus, Trash2, Pencil, Check, X, ChevronDown, ChevronRight, Loader2, Users } from 'lucide-react'
import { OutletMultiSelect } from '@/components/outlet-multi-select'

type Group = { id: string; name: string; member_ids: string[] }
type Outlet = { id: string; name: string }

interface Props {
  groups: Group[]
  outlets: Outlet[]
}

export function OutletGroupsClient({ groups: initial, outlets }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [newName, setNewName] = useState('')
  const [memberEdits, setMemberEdits] = useState<Record<string, string[]>>(
    Object.fromEntries(initial.map(g => [g.id, g.member_ids]))
  )
  const [isPending, startTransition] = useTransition()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    startTransition(async () => {
      await createGroup(name)
      setNewName('')
    })
  }

  function handleDelete(id: string) {
    setDeletingId(id)
    startTransition(async () => {
      await deleteGroup(id)
      setDeletingId(null)
    })
  }

  function handleRename(id: string) {
    const name = editingName.trim()
    if (!name) return
    startTransition(async () => {
      await renameGroup(id, name)
      setEditingId(null)
    })
  }

  function handleSaveMembers(groupId: string) {
    setSavingId(groupId)
    const ids = memberEdits[groupId] ?? []
    startTransition(async () => {
      await setGroupMembers(groupId, ids)
      setSavingId(null)
    })
  }

  return (
    <div className="space-y-4">
      {/* Create form */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Create group</h2>
        <form onSubmit={handleCreate} className="flex gap-3">
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Group name (e.g. Klang Valley)"
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-amber-400 transition-colors"
          />
          <button
            type="submit"
            disabled={isPending || !newName.trim()}
            className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            <Plus size={15} />
            Create
          </button>
        </form>
      </div>

      {/* Group list */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {initial.map((group, i) => {
          const isExpanded = expandedId === group.id
          const isEditing = editingId === group.id
          const memberCount = (memberEdits[group.id] ?? group.member_ids).length

          return (
            <div key={group.id} className={i > 0 ? 'border-t border-gray-100' : ''}>
              {/* Group row */}
              <div className="flex items-center gap-3 px-5 py-4">
                <button
                  type="button"
                  onClick={() => setExpandedId(prev => prev === group.id ? null : group.id)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>

                <div className="w-9 h-9 bg-amber-50 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Users size={16} className="text-amber-500" />
                </div>

                <div className="flex-1 min-w-0">
                  {isEditing ? (
                    <div className="flex items-center gap-2">
                      <input
                        autoFocus
                        value={editingName}
                        onChange={e => setEditingName(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleRename(group.id)
                          if (e.key === 'Escape') setEditingId(null)
                        }}
                        className="flex-1 border border-amber-400 rounded-md px-2 py-1 text-sm text-gray-900 focus:outline-none"
                      />
                      <button onClick={() => handleRename(group.id)} disabled={isPending}
                        className="p-1 text-amber-600 hover:text-amber-700 disabled:opacity-50">
                        <Check size={14} />
                      </button>
                      <button onClick={() => setEditingId(null)}
                        className="p-1 text-gray-400 hover:text-gray-600">
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm font-medium text-gray-900">{group.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {memberCount === 0 ? 'No outlets assigned' : `${memberCount} outlet${memberCount !== 1 ? 's' : ''}`}
                      </p>
                    </>
                  )}
                </div>

                {!isEditing && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => { setEditingId(group.id); setEditingName(group.name) }}
                      className="text-gray-400 hover:text-amber-500 p-1.5 rounded-lg hover:bg-amber-50 transition-colors"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(group.id)}
                      disabled={deletingId === group.id}
                      className="text-gray-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-60"
                    >
                      {deletingId === group.id
                        ? <Loader2 size={14} className="animate-spin" />
                        : <Trash2 size={14} />}
                    </button>
                  </div>
                )}
              </div>

              {/* Expanded outlet selector */}
              {isExpanded && (
                <div className="px-5 pb-5 border-t border-gray-50 bg-gray-50/50">
                  <p className="text-xs font-medium text-gray-600 mt-4 mb-2">Outlets in this group</p>
                  <OutletMultiSelect
                    outlets={outlets}
                    selected={memberEdits[group.id] ?? group.member_ids}
                    onChange={ids => setMemberEdits(prev => ({ ...prev, [group.id]: ids }))}
                  />
                  <div className="flex justify-end mt-3">
                    <button
                      type="button"
                      onClick={() => handleSaveMembers(group.id)}
                      disabled={savingId === group.id || isPending}
                      className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                    >
                      {savingId === group.id
                        ? <Loader2 size={14} className="animate-spin" />
                        : <Check size={14} />}
                      Save outlets
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {!initial.length && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Users size={32} className="text-gray-300 mb-3" />
            <p className="text-sm font-medium text-gray-500">No outlet groups yet</p>
            <p className="text-xs text-gray-400 mt-1">Create a group to schedule multiple outlets at once</p>
          </div>
        )}
      </div>
    </div>
  )
}
