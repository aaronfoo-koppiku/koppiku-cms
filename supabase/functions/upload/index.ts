// supabase/functions/upload/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-file-name, x-file-type',
}

async function getGCSAccessToken(saKey: { client_email: string; private_key: string }): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'RS256', typ: 'JWT' }
  const payload = {
    iss: saKey.client_email,
    scope: 'https://www.googleapis.com/auth/devstorage.read_write',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }

  const b64url = (obj: object) =>
    btoa(JSON.stringify(obj)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')

  const signingInput = `${b64url(header)}.${b64url(payload)}`

  const pemContents = saKey.private_key
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\n/g, '')
  const binaryDer = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0))

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryDer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(signingInput),
  )

  const jwt = `${signingInput}.${btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')}`

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  })

  const { access_token } = await tokenRes.json()
  return access_token
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

  const bucket = Deno.env.get('GCS_BUCKET')!
  const cdnBase = Deno.env.get('CDN_BASE_URL') ?? `https://storage.googleapis.com/${bucket}`
  const saKey = JSON.parse(Deno.env.get('GCS_SA_KEY')!)

  const fileName = req.headers.get('x-file-name') ?? 'upload'
  const mimeType = req.headers.get('x-file-type') ?? 'application/octet-stream'
  const mediaType = mimeType.startsWith('video/') ? 'video' : 'image'
  const objectKey = `${crypto.randomUUID()}-${fileName}`

  const body = await req.arrayBuffer()
  const sizeBytes = body.byteLength

  const accessToken = await getGCSAccessToken(saKey)

  const uploadRes = await fetch(
    `https://storage.googleapis.com/upload/storage/v1/b/${bucket}/o?uploadType=media&name=${encodeURIComponent(objectKey)}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': mimeType,
      },
      body,
    },
  )

  if (!uploadRes.ok) {
    const text = await uploadRes.text()
    return new Response(JSON.stringify({ error: text }), { status: 502 })
  }

  // Files use UUID-based names so URLs are immutable — safe to cache for 1 year
  await fetch(
    `https://storage.googleapis.com/storage/v1/b/${bucket}/o/${encodeURIComponent(objectKey)}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ cacheControl: 'public, max-age=31536000, immutable' }),
    },
  )

  const gcsUrl = `gs://${bucket}/${objectKey}`
  const cdnUrl = `${cdnBase}/${encodeURIComponent(objectKey)}`

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
