// supabase/functions/pair-device/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' }

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  const auth = req.headers.get('authorization')
  const { data: { user }, error } = await supabase.auth.getUser(auth?.replace('Bearer ', '') ?? '')
  if (error || !user) return new Response('Unauthorized', { status: 401 })

  const { pairing_code, outlet_id, device_name } = await req.json() as {
    pairing_code: string
    outlet_id: string
    device_name?: string
  }

  // Find pending device with matching code that hasn't expired
  const { data: device, error: findErr } = await supabase
    .from('devices')
    .select('*')
    .eq('pairing_code', pairing_code)
    .eq('status', 'pending')
    .gt('pairing_code_expires_at', new Date().toISOString())
    .single()

  if (findErr || !device) {
    return new Response(JSON.stringify({ error: 'Invalid or expired pairing code' }), {
      status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  const { data: updated, error: updateErr } = await supabase
    .from('devices')
    .update({ outlet_id, status: 'active', name: device_name ?? 'Screen' })
    .eq('id', device.id)
    .select()
    .single()

  if (updateErr) return new Response(JSON.stringify({ error: updateErr.message }), { status: 500 })

  return new Response(JSON.stringify(updated), {
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
})
