'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createOutlet(formData: FormData) {
  const supabase = await createClient()
  const name = formData.get('name') as string
  const region = formData.get('region') as string
  await supabase.from('outlets').insert({ name, region })
  revalidatePath('/outlets')
}

export async function renameOutlet(id: string, name: string, region: string) {
  const supabase = await createClient()
  await supabase.from('outlets').update({ name, region }).eq('id', id)
  revalidatePath('/outlets')
}

export async function deleteOutlet(id: string) {
  const supabase = await createClient()
  await supabase.from('outlets').delete().eq('id', id)
  revalidatePath('/outlets')
}
