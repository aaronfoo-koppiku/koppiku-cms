// supabase/functions/upload/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-file-name, x-file-type',
}

async function getGCSAccessToken(saKey: { client_email: string; private_key: string }, scope = 'https://www.googleapis.com/auth/devstorage.read_write'): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'RS256', typ: 'JWT' }
  const payload = {
    iss: saKey.client_email,
    scope,
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

// Submits a Cloud Transcoder job: H.264 MP4, 1080p max, ~4Mbps
// Returns the output GCS URI of the transcoded file
async function transcodeVideo(
  inputGcsUri: string,
  outputObjectKey: string,
  bucket: string,
  saKey: { client_email: string; private_key: string },
  projectId: string,
  location = 'asia-southeast1',
): Promise<string> {
  const token = await getGCSAccessToken(saKey, 'https://www.googleapis.com/auth/cloud-platform')
  const outputUri = `gs://${bucket}/transcoded/`

  const jobBody = {
    inputUri: inputGcsUri,
    outputUri,
    config: {
      elementaryStreams: [
        {
          key: 'video-stream',
          videoStream: {
            h264: {
              // 0 = preserve original dimensions (no aspect ratio distortion)
              heightPixels: 0,
              widthPixels: 0,
              bitrateBps: 4_000_000,
              frameRate: 30,
              profile: 'high',
            },
          },
        },
        {
          key: 'audio-stream',
          audioStream: { codec: 'aac', bitrateBps: 128_000 },
        },
      ],
      muxStreams: [
        {
          key: 'mp4',
          container: 'mp4',
          elementaryStreams: ['video-stream', 'audio-stream'],
          fileName: `${outputObjectKey}.mp4`,
        },
      ],
    },
  }

  const createRes = await fetch(
    `https://transcoder.googleapis.com/v1/projects/${projectId}/locations/${location}/jobs`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(jobBody),
    },
  )

  if (!createRes.ok) {
    const err = await createRes.text()
    throw new Error(`Transcoder job create failed: ${err}`)
  }

  const job = await createRes.json()
  const jobName = job.name

  // Poll until job completes (max 5 minutes)
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 5000))
    const pollRes = await fetch(
      `https://transcoder.googleapis.com/v1/${jobName}`,
      { headers: { Authorization: `Bearer ${token}` } },
    )
    const status = await pollRes.json()
    if (status.state === 'SUCCEEDED') {
      return `gs://${bucket}/transcoded/${outputObjectKey}.mp4`
    }
    if (status.state === 'FAILED') {
      throw new Error(`Transcoder job failed: ${JSON.stringify(status.error)}`)
    }
  }

  throw new Error('Transcoder job timed out')
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const auth = req.headers.get('authorization')
  if (!auth) return new Response('Unauthorized', { status: 401 })
  const { data: { user }, error: authErr } = await supabase.auth.getUser(auth.replace('Bearer ', ''))
  if (authErr || !user) return new Response('Unauthorized', { status: 401 })

  const bucket = Deno.env.get('GCS_BUCKET')!
  const cdnBase = Deno.env.get('CDN_BASE_URL') ?? `https://storage.googleapis.com/${bucket}`
  const saKey = JSON.parse(Deno.env.get('GCS_SA_KEY')!)
  const gcpProjectId = Deno.env.get('GCP_PROJECT_ID')!

  const fileName = req.headers.get('x-file-name') ?? 'upload'
  const mimeType = req.headers.get('x-file-type') ?? 'application/octet-stream'
  const mediaType = mimeType.startsWith('video/') ? 'video' : 'image'
  const uuid = crypto.randomUUID()
  const objectKey = `${uuid}-${fileName}`

  const body = await req.arrayBuffer()
  const sizeBytes = body.byteLength

  const accessToken = await getGCSAccessToken(saKey)

  // Upload original to GCS
  const uploadRes = await fetch(
    `https://storage.googleapis.com/upload/storage/v1/b/${bucket}/o?uploadType=media&name=${encodeURIComponent(objectKey)}`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': mimeType },
      body,
    },
  )

  if (!uploadRes.ok) {
    const text = await uploadRes.text()
    return new Response(JSON.stringify({ error: text }), { status: 502 })
  }

  const rawGcsUrl = `gs://${bucket}/${objectKey}`
  let finalGcsUrl = rawGcsUrl
  let finalObjectKey = objectKey
  let finalMime = mimeType

  // Transcode videos to H.264 MP4 for reliable Android TV playback
  if (mediaType === 'video') {
    try {
      const transcodedGcsUrl = await transcodeVideo(rawGcsUrl, uuid, bucket, saKey, gcpProjectId)
      finalGcsUrl = transcodedGcsUrl
      finalObjectKey = `transcoded/${uuid}.mp4`
      finalMime = 'video/mp4'

      // Delete the raw upload to save storage
      await fetch(
        `https://storage.googleapis.com/storage/v1/b/${bucket}/o/${encodeURIComponent(objectKey)}`,
        { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } },
      ).catch(() => {})
    } catch (err) {
      // Transcoding failed — fall back to original upload, log warning
      console.error('Transcoding failed, using original:', err)
    }
  }

  const cdnUrl = `${cdnBase}/${encodeURIComponent(finalObjectKey)}`

  const { data: media, error: dbErr } = await supabase.from('media').insert({
    name: fileName,
    type: mediaType,
    mime_type: finalMime,
    gcs_url: finalGcsUrl,
    cdn_url: cdnUrl,
    size_bytes: sizeBytes,
    uploaded_by: user.id,
  }).select().single()

  if (dbErr) return new Response(JSON.stringify({ error: dbErr.message }), { status: 500 })

  return new Response(JSON.stringify(media), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
