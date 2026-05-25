// supabase/functions/upload/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-file-name, x-file-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Verify auth
  const auth = req.headers.get('authorization')
  if (!auth) return new Response('Unauthorized', { status: 401 })
  const { data: { user }, error: authErr } = await supabase.auth.getUser(auth.replace('Bearer ', ''))
  if (authErr || !user) return new Response('Unauthorized', { status: 401 })

  const fileName = req.headers.get('x-file-name') ?? 'upload'
  const mimeType = req.headers.get('x-file-type') ?? 'application/octet-stream'
  const mediaType = mimeType.startsWith('video/') ? 'video' : 'image'
  const objectKey = `${crypto.randomUUID()}-${fileName}`
  const bucket = Deno.env.get('GCS_BUCKET')!
  const cdnBase = Deno.env.get('CDN_BASE_URL')!

  // Upload to GCS using service account
  const saKey = JSON.parse(Deno.env.get('GCS_SA_KEY')!)
  const token = await getGCSToken(saKey)

  const body = await req.arrayBuffer()
  const sizeBytes = body.byteLength

  const gcsRes = await fetch(
    `https://storage.googleapis.com/upload/storage/v1/b/${bucket}/o?uploadType=media&name=${encodeURIComponent(objectKey)}`,
    { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': mimeType }, body },
  )
  if (!gcsRes.ok) return new Response('GCS upload failed', { status: 502 })

  const gcsUrl = `gs://${bucket}/${objectKey}`
  const cdnUrl = `${cdnBase}/${objectKey}`

  // Insert media row
  const { data: media, error: dbErr } = await supabase.from('media').insert({
    name: fileName,
    type: mediaType,
    mime_type: mimeType,
    gcs_url: gcsUrl,
    cdn_url: cdnUrl,
    size_bytes: sizeBytes,
    uploaded_by: user.id,
  }).select().single()

  if (dbErr) return new Response(JSON.stringify({ error: dbErr.message }), { status: 500 })

  return new Response(JSON.stringify(media), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})

async function getGCSToken(sa: Record<string, string>): Promise<string> {
  const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const now = Math.floor(Date.now() / 1000)
  const payload = btoa(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/devstorage.read_write',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now, exp: now + 3600,
  }))
  const keyData = sa.private_key.replace(/-----.*?-----/g, '').replace(/\s/g, '')
  const binaryKey = Uint8Array.from(atob(keyData), (c) => c.charCodeAt(0))
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8', binaryKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'],
  )
  const sig = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5', cryptoKey,
    new TextEncoder().encode(`${header}.${payload}`),
  )
  const jwt = `${header}.${payload}.${btoa(String.fromCharCode(...new Uint8Array(sig)))}`
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  })
  const { access_token } = await res.json()
  return access_token
}
