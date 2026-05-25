'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function pairDevice(_prev: { error?: string } | null, formData: FormData) {
  const code = formData.get('pairing_code') as string
  const outlet_id = formData.get('outlet_id') as string
  const device_name = formData.get('device_name') as string | null

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Not authenticated' }
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return { error: 'Not authenticated' }

    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/pair-device`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${session.access_token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ pairing_code: code, outlet_id: outlet_id || null, device_name }),
    })

    if (!res.ok) return { error: await res.text() }
    revalidatePath('/devices')
    return { error: undefined }
  } catch (e: any) {
    return { error: e?.message ?? 'Something went wrong' }
  }
}

export async function renameDevice(id: string, name: string) {
  const supabase = await createClient()
  await supabase.from('devices').update({ name }).eq('id', id)
  revalidatePath('/devices')
}
