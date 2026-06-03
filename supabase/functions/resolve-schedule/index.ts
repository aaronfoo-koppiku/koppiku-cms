// supabase/functions/resolve-schedule/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' }

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!)

  const url = new URL(req.url)
  const outletId = url.searchParams.get('outlet_id')
  if (!outletId) return new Response('Missing outlet_id', { status: 400 })

  // Fetch all schedules for this outlet (+ nationwide ones) with published playlists
  const { data: schedules } = await supabase
    .from('schedules')
    .select('*, playlist:playlists(*, fallback_image:fallback_image_id(cdn_url))')
    .or(`outlet_id.eq.${outletId},outlet_id.is.null`)

  // Current Malaysia time using local date parts (not toISOString which is UTC)
  const nowMY = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kuala_Lumpur' }))
  const dayOfWeek = nowMY.getDay()
  const currentTime = `${String(nowMY.getHours()).padStart(2, '0')}:${String(nowMY.getMinutes()).padStart(2, '0')}`
  const today = `${nowMY.getFullYear()}-${String(nowMY.getMonth() + 1).padStart(2, '0')}-${String(nowMY.getDate()).padStart(2, '0')}`

  const active = (schedules ?? []).filter((s: any) => {
    const publishedPlaylist = s.playlist?.status === 'published'
    const dayOk = !s.days_of_week?.length || s.days_of_week.includes(dayOfWeek)
    const timeOk = currentTime >= s.start_time && currentTime < s.end_time
    const dateOk = today >= s.active_from && (!s.active_until || today <= s.active_until)
    return publishedPlaylist && dayOk && timeOk && dateOk
  }).sort((a: any, b: any) => b.priority - a.priority)

  if (!active.length) return new Response(JSON.stringify({ schedule: null, items: [] }), {
    headers: { ...cors, 'Content-Type': 'application/json' },
  })

  const schedule = active[0]
  const { data: items } = await supabase
    .from('playlist_items')
    .select('*, media(*)')
    .eq('playlist_id', schedule.playlist_id)
    .order('sequence')

  const fallbackImageUrl = schedule.playlist?.fallback_image?.cdn_url ?? null

  return new Response(JSON.stringify({ schedule, items: items ?? [], fallback_image_url: fallbackImageUrl }), {
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
})
