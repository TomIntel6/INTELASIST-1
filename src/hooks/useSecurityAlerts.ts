import { useCallback, useEffect, useState } from 'react'
import { API_BASE_URL, getAuthHeaders } from '@/lib/auth'

type SecurityAlert = {
  id: string
  user_id?: string | null
  user_email?: string | null
  user_name?: string | null
  latitude?: number | null
  longitude?: number | null
  address?: string | null
  ip_address?: string | null
  user_agent?: string | null
  platform?: string | null
  device?: string | null
  distance_meters?: number | null
  status?: string | null
  created_at: string
}

type SecurityAlertEventDetail = {
  alert: SecurityAlert
}

export function useSecurityAlerts(enabled = true) {
  const [alerts, setAlerts] = useState<SecurityAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadAlerts = useCallback(async () => {
    if (!enabled) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`${API_BASE_URL}/security/alerts?limit=50`, {
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error((payload as { error?: string }).error || 'No se pudieron cargar las alertas de seguridad.')
      }

      const data = (await response.json()) as { alerts: SecurityAlert[] }
      setAlerts(data.alerts ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error cargando alertas de seguridad.')
    } finally {
      setLoading(false)
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled) {
      return
    }

    void loadAlerts()

    const handleSecurityAlert = (event: Event) => {
      const customEvent = event as CustomEvent<SecurityAlertEventDetail>
      const alert = customEvent.detail?.alert
      if (!alert || typeof alert.id !== 'string') {
        return
      }

      setAlerts((previous) => [alert, ...previous.filter((item) => item.id !== alert.id)])
    }

    window.addEventListener('security-alert', handleSecurityAlert as EventListener)

    return () => {
      window.removeEventListener('security-alert', handleSecurityAlert as EventListener)
    }
  }, [enabled, loadAlerts])

  return {
    alerts,
    loading,
    error,
    refresh: loadAlerts,
  }
}
