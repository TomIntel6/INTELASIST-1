import { getAuthHeaders } from '@/lib/auth'
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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const authHeaders = getAuthHeaders()
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

export async function listShifts(): Promise<Shift[]> {
  const payload = await request<{ shifts: Shift[] }>('/shifts')
  return payload.shifts
}

export async function startShift(): Promise<Shift> {
  const payload = await request<{ shift: Shift }>('/shifts', { method: 'POST', body: '{}' })
  return payload.shift
}

export async function closeShift(id: string): Promise<Shift> {
  const payload = await request<{ shift: Shift }>(`/shifts/${encodeURIComponent(id)}/close`, { method: 'PATCH' })
  return payload.shift
}

export async function getShiftDetail(id: string): Promise<{ shift: Shift; reports: ShiftReport[] }> {
  return request<{ shift: Shift; reports: ShiftReport[] }>(`/shifts/${encodeURIComponent(id)}`)
}
