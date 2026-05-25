export type Outlet = {
  id: string
  name: string
  region: string
  timezone: string
  created_at: string
}

export type DeviceStatus = 'pending' | 'active'

export type Device = {
  id: string
  outlet_id: string | null
  name: string | null
  pairing_code: string
  status: DeviceStatus
  last_seen: string | null
  ua: string | null
}

export type MediaType = 'image' | 'video'

export type Media = {
  id: string
  name: string
  type: MediaType
  mime_type: string
  gcs_url: string
  cdn_url: string
  thumbnail_url: string | null
  duration_s: number | null
  size_bytes: number
  uploaded_by: string
  created_at: string
}

export type PlaylistStatus = 'draft' | 'published'

export type Playlist = {
  id: string
  name: string
  status: PlaylistStatus
  created_by: string
  created_at: string
  updated_at: string
}

export type PlaylistItem = {
  id: string
  playlist_id: string
  media_id: string
  sequence: number
  display_duration_s: number | null
  media?: Media
}

export type Schedule = {
  id: string
  playlist_id: string
  outlet_id: string | null
  start_time: string
  end_time: string
  days_of_week: number[]
  active_from: string
  active_until: string | null
  priority: number
  playlist?: Playlist
}

export type PlaybackLog = {
  id: string
  device_id: string
  playlist_id: string
  media_id: string
  played_at: string
  duration_s: number
}
