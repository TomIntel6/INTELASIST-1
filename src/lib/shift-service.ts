import { AUTH_STORAGE_KEY, getAuthHeaders } from '@/lib/auth'
import { getDefaultApiBase } from '@/lib/supabase'

export type ShiftStatus = 'open' | 'closed'

export interface Shift {
  id: string
  supervisorId: string
  supervisorName: string
  supervisorEmail: string
  status: ShiftStatus
  startedAt: string
  endedAt: string | null
  reportCount: number
  categoryCounts: Record<string, number>
}

export interface ShiftReport {
  id: string
  insured_name: string
  plate: string
  service_type: string
  status: string
  created_by_name: string
  created_at: string
}

const API_BASE = getDefaultApiBase()

async function request<T>(path: string, init?: RequestInit, identity?: { id?: string; email?: string; name?: string }): Promise<T> {
  const authHeaders = getAuthHeaders()
  if (identity?.id) authHeaders['x-user-id'] = identity.id
  if (identity?.email) authHeaders['x-user-email'] = identity.email
  if (identity?.name) authHeaders['x-user-name'] = encodeURIComponent(identity.name)
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...authHeaders, ...(init?.headers ?? {}) },
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(String(payload?.error || (response.status === 401
      ? 'Sesión no válida o caducada. Inicia sesión nuevamente.'
      : 'No se pudo completar la operación.')))
  }
  return payload as T
}

function getIdentity(user?: { id?: string; email?: string; user_metadata?: { full_name?: string } } | null) {
  if (user?.id && user.email) {
    return { id: user.id, email: user.email, name: user.user_metadata?.full_name }
  }

  if (typeof window === 'undefined') return undefined
  try {
    const raw = window.sessionStorage.getItem(AUTH_STORAGE_KEY)
    const stored = raw ? JSON.parse(raw) as { user?: { id?: string; email?: string; user_metadata?: { full_name?: string } } } : null
    if (stored?.user?.id && stored.user.email) {
      return { id: stored.user.id, email: stored.user.email, name: stored.user.user_metadata?.full_name }
    }
  } catch {
    // La sesión puede estar temporalmente incompleta mientras termina de hidratarse.
  }

  return undefined
}

export async function listShifts(user?: { id?: string; email?: string; user_metadata?: { full_name?: string } } | null): Promise<Shift[]> {
  const payload = await request<{ shifts: Shift[] }>('/shifts', undefined, getIdentity(user))
  return payload.shifts
}

export async function startShift(user?: { id?: string; email?: string; user_metadata?: { full_name?: string } } | null): Promise<Shift> {
  const payload = await request<{ shift: Shift }>('/shifts', { method: 'POST', body: '{}' }, getIdentity(user))
  return payload.shift
}

export async function closeShift(id: string, user?: { id?: string; email?: string; user_metadata?: { full_name?: string } } | null): Promise<Shift> {
  const payload = await request<{ shift: Shift }>(`/shifts/${encodeURIComponent(id)}/close`, { method: 'PATCH' }, getIdentity(user))
  return payload.shift
}

export async function getShiftDetail(id: string, user?: { id?: string; email?: string; user_metadata?: { full_name?: string } } | null): Promise<{ shift: Shift; reports: ShiftReport[] }> {
  return request<{ shift: Shift; reports: ShiftReport[] }>(`/shifts/${encodeURIComponent(id)}`, undefined, getIdentity(user))
}
