import { useCallback } from 'react'
import { API_BASE_URL, getAuthHeaders } from '@/lib/auth'

type GeoResult = {
  status: 'Normal' | 'Fuera del perímetro' | 'Ubicación no disponible'
  latitude?: number
  longitude?: number
  distanceMeters?: number
  address?: string | null
}

const COMPANY_LAT = 8.993388089954268
const COMPANY_LON = -79.52128668973099
const ALLOWED_RADIUS_METERS = 100

function toRad(deg: number) {
  return (deg * Math.PI) / 180
}

function haversineDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000 // earth radius meters
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

async function reverseGeocode(lat: number, lon: number): Promise<string | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`
    const res = await fetch(url, { headers: { 'Accept': 'application/json' } })
    if (!res.ok) return null
    const data = await res.json()
    return data.display_name || null
  } catch (err) {
    return null
  }
}

export function useLoginLocation() {
  const report = useCallback(async (userEmail?: string, userId?: string, userName?: string, opts: { timeoutMs?: number } = {}) => {
    const timeoutMs = opts.timeoutMs ?? 8000

    const result: GeoResult = { status: 'Ubicación no disponible' }
    const browserNavigator: Navigator | undefined = typeof window !== 'undefined' ? window.navigator : undefined

    // If geolocation is not available, report no location
    if (!browserNavigator || !('geolocation' in browserNavigator)) {
      // send report with no location
      await fetch(`${API_BASE_URL}/security/login-event`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          user_email: userEmail,
          user_id: userId,
          user_name: userName,
          status: 'Ubicación no disponible',
          user_agent: browserNavigator?.userAgent ?? null,
          platform: browserNavigator?.platform ?? null,
          device: `${browserNavigator?.platform ?? ''}`,
        }),
      }).catch(() => {})

      return result
    }

    const positionPromise = new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, { maximumAge: 0, timeout: timeoutMs })
    })

    try {
      const pos = await positionPromise
      const lat = pos.coords.latitude
      const lon = pos.coords.longitude
      const distance = haversineDistanceMeters(lat, lon, COMPANY_LAT, COMPANY_LON)
      const status = distance > ALLOWED_RADIUS_METERS ? 'Fuera del perímetro' : 'Normal'
      const address = await reverseGeocode(lat, lon)

      // Post event to backend
      await fetch(`${API_BASE_URL}/security/login-event`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          user_email: userEmail,
          user_id: userId,
          user_name: userName,
          latitude: lat,
          longitude: lon,
          distance_meters: Math.round(distance),
          address,
          status,
          user_agent: browserNavigator.userAgent,
          platform: browserNavigator.platform,
          device: `${browserNavigator.platform}`,
        }),
      }).catch(() => {})

      return { status, latitude: lat, longitude: lon, distanceMeters: Math.round(distance), address }
    } catch (err) {
      // If permission denied or error, still notify backend that location was not available
      await fetch(`${API_BASE_URL}/security/login-event`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          user_email: userEmail,
          user_id: userId,
          user_name: userName,
          status: 'Ubicación no disponible',
          user_agent: browserNavigator?.userAgent ?? null,
          platform: browserNavigator?.platform ?? null,
          device: `${browserNavigator?.platform ?? ''}`,
        }),
      }).catch(() => {})

      return result
    }
  }, [])

  return { report }
}

export default useLoginLocation
