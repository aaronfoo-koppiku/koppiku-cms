'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createSchedule(formData: FormData) {
  const supabase = await createClient()
  const daysRaw = formData.getAll('days_of_week').map(Number)
  await supabase.from('schedules').insert({
    playlist_id: formData.get('playlist_id') as string,
    outlet_id: (formData.get('outlet_id') as string) || null,
    start_time: formData.get('start_time') as string,
    end_time: formData.get('end_time') as string,
    days_of_week: daysRaw,
    active_from: formData.get('active_from') as string,
    active_until: (formData.get('active_until') as string) || null,
    priority: Number(formData.get('priority')) || 1,
  })
  revalidatePath('/schedules')
}

export async function deleteSchedule(id: string) {
  const supabase = await createClient()
  await supabase.from('schedules').delete().eq('id', id)
  revalidatePath('/schedules')
}

export async function updateSchedule(id: string, formData: FormData) {
  const supabase = await createClient()
  const daysRaw = formData.getAll('days_of_week').map(Number)
  await supabase.from('schedules').update({
    playlist_id: formData.get('playlist_id') as string,
    outlet_id: (formData.get('outlet_id') as string) || null,
    start_time: formData.get('start_time') as string,
    end_time: formData.get('end_time') as string,
    days_of_week: daysRaw,
    active_from: formData.get('active_from') as string,
    active_until: (formData.get('active_until') as string) || null,
    priority: Number(formData.get('priority')) || 1,
  }).eq('id', id)
  revalidatePath('/schedules')
}
