'use client'
import { useState, useTransition } from 'react'
import { createSchedule, deleteSchedule, updateSchedule } from './actions'
import { Calendar, List, Plus, Trash2, Clock, X, Loader2, Pencil } from 'lucide-react'
import { SubmitButton } from '@/components/submit-button'

const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DAYS_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function getWeekDates(): Date[] {
  const today = new Date()
  const startOfWeek = new Date(today)
  startOfWeek.setDate(today.getDate() - today.getDay())
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startOfWeek)
    d.setDate(startOfWeek.getDate() + i)
    return d
  })
}
const ROW_H = 48

const PALETTE = [
  { bg: 'rgba(251,191,36,0.18)', solid: '#f59e0b', text: '#78350f' },
  { bg: 'rgba(96,165,250,0.18)', solid: '#3b82f6', text: '#1e3a8a' },
  { bg: 'rgba(52,211,153,0.18)', solid: '#10b981', text: '#064e3b' },
  { bg: 'rgba(192,132,252,0.18)', solid: '#a855f7', text: '#4c1d95' },
  { bg: 'rgba(248,113,113,0.18)', solid: '#ef4444', text: '#7f1d1d' },
  { bg: 'rgba(56,189,248,0.18)', solid: '#0ea5e9', text: '#0c4a6e' },
  { bg: 'rgba(244,114,182,0.18)', solid: '#ec4899', text: '#831843' },
  { bg: 'rgba(110,231,183,0.18)', solid: '#34d399', text: '#065f46' },
]

type Schedule = {
  id: string
  playlist_id: string
  outlet_id: string | null
  outlet_group_id: string | null
  start_time: string
  end_time: string
  days_of_week: number[]
  priority: number
  active_from: string
  active_until: string | null
  playlist: { name: string } | null
  outlet: { name: string } | null
  outlet_group: { name: string } | null
}

type Outlet = { id: string; name: string }
type OutletGroup = { id: string; name: string }
type GroupMember = { group_id: string; outlet_id: string }

interface Props {
  schedules: Schedule[]
  outlets: Outlet[]
  playlists: { id: string; name: string }[]
  groups: OutletGroup[]
  groupMembers: GroupMember[]
}

function parseTimeFraction(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h + (m || 0) / 60
}

function pad(n: number) { return String(n).padStart(2, '0') }

function scheduleTargetLabel(s: Schedule): string {
  if (s.outlet?.name) return s.outlet.name
  if (s.outlet_group?.name) return `${s.outlet_group.name} (group)`
  return 'All outlets'
}

// Segmented 3-way target selector used in create/edit forms
function TargetSelector({
  outlets,
  groups,
  defaultType = 'all',
  defaultOutletId = '',
  defaultGroupId = '',
}: {
  outlets: Outlet[]
  groups: OutletGroup[]
  defaultType?: 'all' | 'outlet' | 'group'
  defaultOutletId?: string
  defaultGroupId?: string
}) {
  const [type, setType] = useState<'all' | 'outlet' | 'group'>(defaultType)
  const selectCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-amber-400 transition-colors'

  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-gray-600">Target</label>
      <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-medium">
        {(['all', 'outlet', 'group'] as const).map((t, i) => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            className={`flex-1 py-2 transition-colors ${
              type === t ? 'bg-amber-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
            } ${i > 0 ? 'border-l border-gray-200' : ''}`}
          >
            {t === 'all' ? 'All outlets' : t === 'outlet' ? 'Outlet' : 'Group'}
          </button>
        ))}
      </div>
      {type === 'all' && (
        <>
          <input type="hidden" name="outlet_id" value="" />
          <input type="hidden" name="outlet_group_id" value="" />
        </>
      )}
      {type === 'outlet' && (
        <>
          <select name="outlet_id" defaultValue={defaultOutletId} className={selectCls}>
            <option value="">Select outlet…</option>
            {outlets.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
          <input type="hidden" name="outlet_group_id" value="" />
        </>
      )}
      {type === 'group' && (
        <>
          <input type="hidden" name="outlet_id" value="" />
          <select name="outlet_group_id" defaultValue={defaultGroupId} className={selectCls}>
            <option value="">Select group…</option>
            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </>
      )}
    </div>
  )
}

export function ScheduleView({ schedules, outlets, playlists, groups, groupMembers }: Props) {
  const [view, setView] = useState<'calendar' | 'list'>('calendar')
  const [outletId, setOutletId] = useState<string>('all')
  const weekDates = getWeekDates()
  const today = new Date()
  const todayIndex = today.getDay()
  const [quickAdd, setQuickAdd] = useState<{ day: number; hour: number } | null>(null)
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null)
  const [isPending, startTransition] = useTransition()
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const playlistColorIndex: Record<string, number> = {}
  playlists.forEach((p, i) => { playlistColorIndex[p.id] = i })
  const getColor = (pid: string) => PALETTE[playlistColorIndex[pid] % PALETTE.length] ?? PALETTE[0]

  const filtered = schedules.filter(s => {
    if (outletId === 'all') return true
    if (s.outlet_id === null && s.outlet_group_id === null) return true
    if (s.outlet_id === outletId) return true
    if (s.outlet_group_id) {
      return groupMembers.some(m => m.group_id === s.outlet_group_id && m.outlet_id === outletId)
    }
    return false
  })

  const blocksByDay: Record<number, (Schedule & { top: number; height: number; color: typeof PALETTE[0] })[]> = {}
  for (let d = 0; d < 7; d++) blocksByDay[d] = []
  for (const s of filtered) {
    const startF = parseTimeFraction(s.start_time)
    const endF = parseTimeFraction(s.end_time)
    const top = startF * ROW_H
    const height = Math.max((endF - startF) * ROW_H, 20)
    const color = getColor(s.playlist_id)
    const days = s.days_of_week.length === 0 ? [0, 1, 2, 3, 4, 5, 6] : s.days_of_week
    for (const day of days) blocksByDay[day].push({ ...s, top, height, color })
  }

  function handleColumnClick(e: React.MouseEvent<HTMLDivElement>, day: number) {
    const rect = e.currentTarget.getBoundingClientRect()
    const hour = Math.max(0, Math.min(23, Math.floor((e.clientY - rect.top) / ROW_H)))
    setQuickAdd({ day, hour })
  }

  function handleQuickAddSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      await createSchedule(fd)
      setQuickAdd(null)
    })
  }

  function handleEditSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const id = editingSchedule!.id
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      await updateSchedule(id, fd)
      setEditingSchedule(null)
    })
  }

  function handleDeleteClick(id: string) {
    setDeletingId(id)
    startTransition(async () => {
      await deleteSchedule(id)
      setDeletingId(null)
    })
  }

  const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-amber-400 transition-colors'

  return (
    <div className="space-y-4">
      {/* Controls row */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <select
          value={outletId}
          onChange={e => setOutletId(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-amber-400 bg-white"
        >
          <option value="all">All outlets</option>
          {outlets.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>

        <div className="flex items-center bg-gray-100 rounded-lg p-1">
          {(['calendar', 'list'] as const).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors capitalize ${
                view === v ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {v === 'calendar' ? <Calendar size={13} /> : <List size={13} />}
              {v}
            </button>
          ))}
        </div>
      </div>

      {view === 'calendar' ? (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {/* Day header */}
          <div className="grid border-b border-gray-100 sticky top-0 bg-white z-20"
            style={{ gridTemplateColumns: '3.5rem repeat(7, 1fr)' }}>
            <div className="border-r border-gray-100" />
            {DAYS_SHORT.map((d, i) => {
              const isToday = i === todayIndex
              const date = weekDates[i]
              return (
                <div key={i} className={`py-2.5 text-center border-r border-gray-100 last:border-r-0 ${isToday ? 'bg-amber-50' : ''}`}>
                  <p className={`text-xs font-semibold uppercase tracking-wide ${isToday ? 'text-amber-600' : 'text-gray-500'}`}>
                    {d}
                  </p>
                  <p className={`text-xs mt-0.5 font-medium tabular-nums ${isToday ? 'text-amber-500' : 'text-gray-400'}`}>
                    {date.getDate()} {MONTHS_SHORT[date.getMonth()]}
                  </p>
                </div>
              )
            })}
          </div>

          {/* Scrollable grid */}
          <div className="overflow-y-auto" style={{ maxHeight: '72vh' }}>
            <div className="grid" style={{ gridTemplateColumns: '3.5rem repeat(7, 1fr)' }}>
              {/* Hour labels */}
              <div className="border-r border-gray-100">
                {Array.from({ length: 24 }, (_, h) => (
                  <div key={h} style={{ height: ROW_H }}
                    className="border-b border-gray-50 flex items-start justify-end pr-2 pt-1">
                    <span className="text-xs text-gray-400 tabular-nums">{pad(h)}:00</span>
                  </div>
                ))}
              </div>

              {/* Day columns */}
              {Array.from({ length: 7 }, (_, day) => (
                <div
                  key={day}
                  className="relative border-r border-gray-100 last:border-r-0 cursor-pointer group/col"
                  style={{ height: ROW_H * 24 }}
                  onClick={e => handleColumnClick(e, day)}
                >
                  {Array.from({ length: 24 }, (_, h) => (
                    <div key={h} style={{ top: h * ROW_H, height: ROW_H }}
                      className="absolute inset-x-0 border-b border-gray-50 hover:bg-amber-50/50 transition-colors" />
                  ))}

                  {blocksByDay[day].map((block, i) => (
                    <div
                      key={`${block.id}-${i}`}
                      style={{
                        top: block.top + 1,
                        height: block.height - 2,
                        left: 2,
                        right: 2,
                        background: block.color.bg,
                        borderLeft: `3px solid ${block.color.solid}`,
                      }}
                      className="absolute rounded-md px-1.5 py-1 overflow-hidden z-10 group/block flex flex-col"
                      onClick={e => e.stopPropagation()}
                      title={`${block.playlist?.name} · ${block.start_time.slice(0, 5)}–${block.end_time.slice(0, 5)} · ${scheduleTargetLabel(block)}`}
                    >
                      <span className="text-xs font-semibold truncate leading-tight"
                        style={{ color: block.color.text }}>
                        {block.playlist?.name}
                      </span>
                      {block.height >= 36 && (
                        <span className="text-xs leading-tight tabular-nums opacity-70"
                          style={{ color: block.color.text }}>
                          {block.start_time.slice(0, 5)}–{block.end_time.slice(0, 5)}
                        </span>
                      )}
                      <button
                        onClick={e => { e.stopPropagation(); setEditingSchedule(block) }}
                        className="absolute top-1 right-6 opacity-0 group-hover/block:opacity-100 p-0.5 rounded text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-opacity"
                      >
                        <Pencil size={11} />
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); handleDeleteClick(block.id) }}
                        disabled={deletingId === block.id}
                        className="absolute top-1 right-1 opacity-0 group-hover/block:opacity-100 p-0.5 rounded text-red-400 hover:text-red-600 hover:bg-red-50 transition-opacity disabled:opacity-100"
                      >
                        {deletingId === block.id
                          ? <Loader2 size={11} className="animate-spin" />
                          : <X size={11} />}
                      </button>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          <div className="px-4 py-2 border-t border-gray-100 bg-gray-50">
            <p className="text-xs text-gray-400">Click any empty slot to add · Hover a block to edit or delete</p>
          </div>
        </div>
      ) : (
        /* List view */
        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Add schedule</h2>
            <form action={createSchedule} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-600">Playlist</label>
                  <select name="playlist_id" required className={inputCls}>
                    <option value="">Select playlist...</option>
                    {playlists.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <TargetSelector outlets={outlets} groups={groups} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-600">Start time</label>
                  <input type="time" name="start_time" required className={inputCls} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-600">End time</label>
                  <input type="time" name="end_time" required className={inputCls} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-600">Active from</label>
                  <input type="date" name="active_from" required className={inputCls} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-600">Active until <span className="text-gray-400 font-normal">(blank = forever)</span></label>
                  <input type="date" name="active_until" className={inputCls} />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-600">Days <span className="text-gray-400 font-normal">(none = every day)</span></label>
                <div className="flex gap-2">
                  {DAYS_SHORT.map((d, i) => (
                    <label key={i} className="flex flex-col items-center gap-1 cursor-pointer group">
                      <input type="checkbox" name="days_of_week" value={i} className="sr-only peer" />
                      <span className="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center text-xs text-gray-500 peer-checked:bg-amber-500 peer-checked:text-white peer-checked:border-amber-500 group-hover:border-amber-300 transition-colors">
                        {d}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex items-end gap-4 pt-1">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-600">Priority</label>
                  <input type="number" name="priority" defaultValue={1} min={1}
                    className="w-20 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-amber-400 transition-colors" />
                </div>
                <SubmitButton className="bg-amber-500 hover:bg-amber-400 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                  <Plus size={15} />
                  Add Schedule
                </SubmitButton>
              </div>
            </form>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            {filtered.map((s, i) => (
              <div key={s.id} className={`flex items-center justify-between px-5 py-4 ${i > 0 ? 'border-t border-gray-100' : ''}`}>
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-9 rounded-full" style={{ background: getColor(s.playlist_id).solid }} />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{s.playlist?.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Clock size={11} className="text-gray-400" />
                      <p className="text-xs text-gray-500">
                        {s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}
                        {' · '}
                        {s.days_of_week.length === 0 ? 'Every day' : s.days_of_week.map(d => DAYS_SHORT[d]).join(', ')}
                        {' · '}
                        {scheduleTargetLabel(s)}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setEditingSchedule(s)}
                    className="text-gray-400 hover:text-amber-500 p-1.5 rounded-lg hover:bg-amber-50 transition-colors"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={() => handleDeleteClick(s.id)}
                    disabled={deletingId === s.id}
                    className="text-gray-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-60"
                  >
                    {deletingId === s.id
                      ? <Loader2 size={15} className="animate-spin" />
                      : <Trash2 size={15} />}
                  </button>
                </div>
              </div>
            ))}
            {!filtered.length && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Calendar size={32} className="text-gray-300 mb-3" />
                <p className="text-sm font-medium text-gray-500">No schedules yet</p>
                <p className="text-xs text-gray-400 mt-1">Add a schedule above</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Quick-add modal */}
      {quickAdd && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4"
          onClick={() => setQuickAdd(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-5">
              <div>
                <h3 className="text-base font-semibold text-gray-900">Add schedule</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {DAYS_FULL[quickAdd.day]}, {pad(quickAdd.hour)}:00 – {pad(Math.min(quickAdd.hour + 1, 23))}:00
                </p>
              </div>
              <button onClick={() => setQuickAdd(null)}
                className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors">
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleQuickAddSubmit} className="space-y-4">
              <input type="hidden" name="active_from" value={new Date().toISOString().split('T')[0]} />
              <input type="hidden" name="days_of_week" value={quickAdd.day} />
              <input type="hidden" name="priority" value="1" />

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-600">Playlist</label>
                <select name="playlist_id" required className={inputCls}>
                  <option value="">Select playlist...</option>
                  {playlists.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              <TargetSelector
                outlets={outlets}
                groups={groups}
                defaultType={outletId !== 'all' ? 'outlet' : 'all'}
                defaultOutletId={outletId !== 'all' ? outletId : ''}
              />

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-600">Start</label>
                  <input type="time" name="start_time" required
                    defaultValue={`${pad(quickAdd.hour)}:00`} className={inputCls} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-600">End</label>
                  <input type="time" name="end_time" required
                    defaultValue={`${pad(Math.min(quickAdd.hour + 1, 23))}:00`} className={inputCls} />
                </div>
              </div>

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setQuickAdd(null)}
                  className="flex-1 border border-gray-200 text-gray-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={isPending}
                  className="flex-1 bg-amber-500 hover:bg-amber-400 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
                  {isPending ? 'Saving…' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit schedule modal */}
      {editingSchedule && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4"
          onClick={() => setEditingSchedule(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-5">
              <h3 className="text-base font-semibold text-gray-900">Edit schedule</h3>
              <button onClick={() => setEditingSchedule(null)}
                className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors">
                <X size={15} />
              </button>
            </div>

            <form key={editingSchedule.id} onSubmit={handleEditSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-600">Playlist</label>
                  <select name="playlist_id" required defaultValue={editingSchedule.playlist_id} className={inputCls}>
                    <option value="">Select playlist...</option>
                    {playlists.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <TargetSelector
                  outlets={outlets}
                  groups={groups}
                  defaultType={
                    editingSchedule.outlet_group_id ? 'group'
                    : editingSchedule.outlet_id ? 'outlet'
                    : 'all'
                  }
                  defaultOutletId={editingSchedule.outlet_id ?? ''}
                  defaultGroupId={editingSchedule.outlet_group_id ?? ''}
                />
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-600">Start time</label>
                  <input type="time" name="start_time" required
                    defaultValue={editingSchedule.start_time.slice(0, 5)} className={inputCls} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-600">End time</label>
                  <input type="time" name="end_time" required
                    defaultValue={editingSchedule.end_time.slice(0, 5)} className={inputCls} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-600">Active from</label>
                  <input type="date" name="active_from" required
                    defaultValue={editingSchedule.active_from} className={inputCls} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-600">Active until <span className="text-gray-400 font-normal">(blank = forever)</span></label>
                  <input type="date" name="active_until"
                    defaultValue={editingSchedule.active_until ?? ''} className={inputCls} />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-600">Days <span className="text-gray-400 font-normal">(none = every day)</span></label>
                <div className="flex gap-2">
                  {DAYS_SHORT.map((d, i) => (
                    <label key={i} className="flex flex-col items-center gap-1 cursor-pointer group">
                      <input
                        type="checkbox"
                        name="days_of_week"
                        value={i}
                        defaultChecked={editingSchedule.days_of_week.includes(i)}
                        className="sr-only peer"
                      />
                      <span className="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center text-xs text-gray-500 peer-checked:bg-amber-500 peer-checked:text-white peer-checked:border-amber-500 group-hover:border-amber-300 transition-colors">
                        {d}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex items-end gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-600">Priority</label>
                  <input type="number" name="priority" defaultValue={editingSchedule.priority} min={1}
                    className="w-20 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-amber-400 transition-colors" />
                </div>
                <div className="flex flex-1 gap-3">
                  <button type="button" onClick={() => setEditingSchedule(null)}
                    className="flex-1 border border-gray-200 text-gray-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
                    Cancel
                  </button>
                  <button type="submit" disabled={isPending}
                    className="flex-1 bg-amber-500 hover:bg-amber-400 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
                    {isPending ? 'Saving…' : 'Save changes'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
