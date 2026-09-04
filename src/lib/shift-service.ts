import { AUTH_STORAGE_KEY, getAuthHeaders, handleAuthenticationFailure } from '@/lib/auth'
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
  reportsAtStart: number
  reportsAtClose: number | null
  generatedReports: number
  closingObservation: string | null
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

function normalizeShift(raw: Partial<Shift> & Record<string, unknown>): Shift {
  const startedAt = raw.startedAt ?? raw.started_at ?? raw.startTime ?? raw.start_time
  const endedAt = raw.endedAt ?? raw.ended_at ?? raw.endTime ?? raw.end_time ?? null

  return {
    id: String(raw.id ?? ''),
    supervisorId: String(raw.supervisorId ?? raw.supervisor_id ?? ''),
    supervisorName: String(raw.supervisorName ?? raw.supervisor_name ?? raw.supervisorEmail ?? raw.supervisor_email ?? 'Supervisor'),
    supervisorEmail: String(raw.supervisorEmail ?? raw.supervisor_email ?? ''),
    status: raw.status === 'closed' ? 'closed' : 'open',
    startedAt: typeof startedAt === 'string' && startedAt ? startedAt : new Date(0).toISOString(),
    endedAt: typeof endedAt === 'string' && endedAt ? endedAt : null,
    reportCount: Number(raw.reportCount ?? raw.report_count ?? 0),
    reportsAtStart: Number(raw.reportsAtStart ?? raw.started_reports_count ?? 0),
    reportsAtClose: raw.reportsAtClose == null && raw.closed_reports_count == null
      ? null
      : Number(raw.reportsAtClose ?? raw.closed_reports_count),
    generatedReports: Number(raw.generatedReports ?? 0),
    closingObservation: (raw.closingObservation ?? raw.closing_observation ?? null) as string | null,
    categoryCounts: (raw.categoryCounts ?? raw.category_counts ?? {}) as Record<string, number>,
  }
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
    if (response.status === 401) {
      handleAuthenticationFailure()
    }
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
  return (Array.isArray(payload.shifts) ? payload.shifts : [])
    .map(shift => normalizeShift(shift as Partial<Shift> & Record<string, unknown>))
    .filter(shift => shift.id)
}

export async function startShift(user?: { id?: string; email?: string; user_metadata?: { full_name?: string } } | null): Promise<Shift> {
  const payload = await request<{ shift: Shift }>('/shifts', { method: 'POST', body: '{}' }, getIdentity(user))
  return normalizeShift(payload.shift as Partial<Shift> & Record<string, unknown>)
}

export async function closeShift(id: string, user?: { id?: string; email?: string; user_metadata?: { full_name?: string } } | null, observation = ''): Promise<Shift> {
  const payload = await request<{ shift: Shift }>(`/shifts/${encodeURIComponent(id)}/close`, { method: 'PATCH', body: JSON.stringify({ observation }) }, getIdentity(user))
  return normalizeShift(payload.shift as Partial<Shift> & Record<string, unknown>)
}

export async function deleteClosedShift(id: string, user?: { id?: string; email?: string; user_metadata?: { full_name?: string } } | null): Promise<void> {
  await request<{ ok: boolean }>(`/shifts/${encodeURIComponent(id)}`, { method: 'DELETE' }, getIdentity(user))
}

export async function getShiftDetail(id: string, user?: { id?: string; email?: string; user_metadata?: { full_name?: string } } | null): Promise<{ shift: Shift; reports: ShiftReport[] }> {
  const payload = await request<{ shift: Shift; reports: ShiftReport[] }>(`/shifts/${encodeURIComponent(id)}`, undefined, getIdentity(user))
  return {
    shift: normalizeShift(payload.shift as Partial<Shift> & Record<string, unknown>),
    reports: Array.isArray(payload.reports) ? payload.reports : [],
  }
}
