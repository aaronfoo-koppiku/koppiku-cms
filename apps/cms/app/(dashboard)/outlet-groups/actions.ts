'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createGroup(name: string) {
  const supabase = await createClient()
  await supabase.from('outlet_groups').insert({ name })
  revalidatePath('/outlet-groups')
}

export async function deleteGroup(id: string) {
  const supabase = await createClient()
  await supabase.from('outlet_groups').delete().eq('id', id)
  revalidatePath('/outlet-groups')
  revalidatePath('/schedules')
}

export async function renameGroup(id: string, name: string) {
  const supabase = await createClient()
  await supabase.from('outlet_groups').update({ name }).eq('id', id)
  revalidatePath('/outlet-groups')
}

export async function setGroupMembers(groupId: string, outletIds: string[]) {
  const supabase = await createClient()
  await supabase.from('outlet_group_members').delete().eq('group_id', groupId)
  if (outletIds.length > 0) {
    await supabase.from('outlet_group_members').insert(
      outletIds.map(outlet_id => ({ group_id: groupId, outlet_id }))
    )
  }
  revalidatePath('/outlet-groups')
  revalidatePath('/schedules')
}
