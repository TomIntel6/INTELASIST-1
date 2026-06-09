export type ServiceType =
  | 'Grua por Averia'
  | 'Inspeccion'
  | 'Grua por Accidente'
  | 'Cerrajeria Vial'
  | 'Paso de Corriente'
  | 'Cambio de Neumatico'

export type ReportStatus =
  | 'Seguimiento de caso'
  | 'Caso Finalizado'
  | 'Falta de Informacion'
  | 'Informativo'
  | 'Validacion'
  | 'Cotizacion'

export const SERVICE_TYPES: ServiceType[] = [
  'Grua por Averia',
  'Inspeccion',
  'Grua por Accidente',
  'Cerrajeria Vial',
  'Paso de Corriente',
  'Cambio de Neumatico',
]

export const REPORT_STATUSES: ReportStatus[] = [
  'Seguimiento de caso',
  'Caso Finalizado',
  'Falta de Informacion',
  'Informativo',
  'Validacion',
  'Cotizacion',
]

export function isFinalizedStatus(status: string | null | undefined) {
  return status === 'Caso Finalizado' || status === 'Informativo' || status === 'Validacion'
}

export function hasValidReportMeta(report: { month?: string | null; year?: number | null }) {
  if (typeof report.year !== 'number' || !Number.isFinite(report.year) || report.year <= 0) {
    return false
  }

  return typeof report.month === 'string' && report.month.trim().length > 0
}

export const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

export interface Report {
  id: string
  month: string
  year: number
  insured_name: string
  plate: string
  policy: string
  service_type: string
  coverage?: string | null
  brand: string
  model: string
  color: string
  year_vehicle: number | null
  status: string
  observation_comment: string
  evidence_url?: string | null
  evidence_filename?: string | null
  evidence_path?: string | null
  created_by: string | null
  created_by_name: string
  created_by_email: string
  created_at: string
  updated_at: string
  report_updates?: ReportUpdate[]
}

export interface ReportUpdate {
  id: string
  report_id: string
  status: string
  comment: string
  added_by: string | null
  added_by_name: string
  added_by_email: string
  created_at: string
}

export const getDefaultApiBase = () => {
  if (import.meta.env.VITE_API_BASE_URL) return import.meta.env.VITE_API_BASE_URL
  return 'https://intelasist.onrender.com'
}
const API_BASE_URL = getDefaultApiBase()
const REPORTS_CACHE_KEY = 'intelasist-shared-reports-cache-v1'
const REPORTS_CACHE_PREFIX = 'intelasist-shared-reports-cache-v2'

function createId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function normalizeCacheSegment(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
}

function monthCacheKey(month: string, year: number) {
  return `${REPORTS_CACHE_PREFIX}:${year}:${normalizeCacheSegment(month)}`
}

function getAllMonthCacheKeys() {
  if (typeof window === 'undefined') {
    return []
  }

  const keys: string[] = []
  for (let i = 0; i < window.localStorage.length; i += 1) {
    const key = window.localStorage.key(i)
    if (key?.startsWith(`${REPORTS_CACHE_PREFIX}:`)) {
      keys.push(key)
    }
  }

  return keys
}

function readCacheKey<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') {
    return fallback
  }

  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) {
      return fallback
    }

    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function writeCacheKey<T>(key: string, value: T) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(key, JSON.stringify(value))
}

function mergeReports(existing: Report[], next: Report[]) {
  const map = new Map(existing.map(report => [report.id, report]))
  for (const report of next) {
    map.set(report.id, report)
  }
  return Array.from(map.values())
}

function replaceCacheReports(key: string, reports: Report[]) {
  writeCacheKey(key, sortReports(reports))
}

function mergeCacheReports(key: string, reports: Report[]) {
  const existing = readCacheKey<unknown[]>(key, [])
  const normalizedExisting = Array.isArray(existing)
    ? existing.map(item => normalizeReport(item as Record<string, unknown>))
    : []
  const merged = mergeReports(normalizedExisting, reports)
  writeCacheKey(key, sortReports(merged))
}

function writeCache(reports: Report[], options?: { replaceMonth?: boolean }) {
  if (typeof window === 'undefined') {
    return
  }

  const groups = reports.reduce<Record<string, Report[]>>((acc, report) => {
    const key = monthCacheKey(report.month, report.year)
    if (!acc[key]) {
      acc[key] = []
    }
    acc[key].push(report)
    return acc
  }, {})

  for (const [key, items] of Object.entries(groups)) {
    if (options?.replaceMonth) {
      replaceCacheReports(key, items)
    } else {
      mergeCacheReports(key, items)
    }
  }
}

function getAllCachedReportsFromMonthKeys(): Report[] {
  const monthKeys = getAllMonthCacheKeys()
  const reports: Report[] = []

  for (const key of monthKeys) {
    const raw = readCacheKey<unknown[]>(key, [])
    if (!Array.isArray(raw)) {
      continue
    }

    reports.push(...raw.map(item => normalizeReport(item as Record<string, unknown>)))
  }

  return sortReports(reports)
}

function readLegacyCache(): Report[] {
  const raw = readCacheKey<unknown>(REPORTS_CACHE_KEY, null as unknown)
  if (!raw || !Array.isArray(raw)) {
    return []
  }

  return raw.map(item => normalizeReport(item as Record<string, unknown>))
}

function migrateLegacyCache() {
  const legacyReports = readLegacyCache()
  if (legacyReports.length === 0) {
    return
  }

  writeCache(legacyReports, { replaceMonth: true })
  window.localStorage.removeItem(REPORTS_CACHE_KEY)
}

function sortReports(reports: Report[]) {
  return [...reports].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
}

function normalizeUpdate(raw: Record<string, unknown>): ReportUpdate {
  return {
    id: String(raw.id ?? createId()),
    report_id: String(raw.report_id ?? ''),
    status: String(raw.status ?? 'Seguimiento de caso'),
    comment: String(raw.comment ?? ''),
    added_by: raw.added_by === null || raw.added_by === undefined ? null : String(raw.added_by),
    added_by_name: String(raw.added_by_name ?? ''),
    added_by_email: String(raw.added_by_email ?? ''),
    created_at: String(raw.created_at ?? new Date().toISOString()),
  }
}

function normalizeReport(raw: Record<string, unknown>): Report {
  const updates = Array.isArray(raw.report_updates)
    ? raw.report_updates.map(item => normalizeUpdate(item as Record<string, unknown>))
    : []

  return {
    id: String(raw.id ?? createId()),
    month: String(raw.month ?? ''),
    year: Number(raw.year ?? 0),
    insured_name: String(raw.insured_name ?? ''),
    plate: String(raw.plate ?? ''),
    policy: String(raw.policy ?? ''),
    service_type: String(raw.service_type ?? ''),
    coverage: raw.coverage === undefined || raw.coverage === null ? null : String(raw.coverage),
    brand: String(raw.brand ?? ''),
    model: String(raw.model ?? ''),
    color: String(raw.color ?? ''),
    year_vehicle: raw.year_vehicle === null || raw.year_vehicle === undefined ? null : Number(raw.year_vehicle),
    status: String(raw.status ?? 'Seguimiento de caso'),
    observation_comment: String(raw.observation_comment ?? ''),
    evidence_url: raw.evidence_url === null || raw.evidence_url === undefined ? null : String(raw.evidence_url),
    evidence_filename: raw.evidence_filename === null || raw.evidence_filename === undefined ? null : String(raw.evidence_filename),
    evidence_path: raw.evidence_path === null || raw.evidence_path === undefined ? null : String(raw.evidence_path),
    created_by: raw.created_by === null || raw.created_by === undefined ? null : String(raw.created_by),
    created_by_name: String(raw.created_by_name ?? ''),
    created_by_email: String(raw.created_by_email ?? ''),
    created_at: String(raw.created_at ?? new Date().toISOString()),
    updated_at: String(raw.updated_at ?? raw.created_at ?? new Date().toISOString()),
    report_updates: updates,
  }
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  })

  const text = await response.text()
  
  // Check if response is HTML (error from server)
  if (text.startsWith('<')) {
    console.error('Server returned HTML instead of JSON:', text.substring(0, 200))
    throw new Error(`Error del servidor: ${response.status}. Por favor intenta de nuevo.`)
  }
  
  const payload = text ? JSON.parse(text) : null

  if (!response.ok) {
    throw new Error(payload?.error ?? `Error ${response.status}`)
  }

  return payload as T
}

function normalizeReportPayload(report: Omit<Report, 'id' | 'created_at' | 'updated_at' | 'report_updates'>) {
  return {
    ...report,
    coverage: report.coverage ?? null,
  }
}

export function getCachedReports(): Report[] {
  const monthKeys = getAllMonthCacheKeys()
  if (monthKeys.length > 0) {
    return getAllCachedReportsFromMonthKeys()
  }

  migrateLegacyCache()
  return getAllCachedReportsFromMonthKeys()
}

export function getCachedReportsForMonth(month: string, year: number): Report[] {
  if (getAllMonthCacheKeys().length === 0) {
    migrateLegacyCache()
  }

  const key = monthCacheKey(month, year)
  const raw = readCacheKey<unknown[]>(key, [])
  if (!Array.isArray(raw)) {
    return []
  }

  return sortReports(raw.map(item => normalizeReport(item as Record<string, unknown>)))
}

export function getCachedReportsForYear(year: number): Report[] {
  if (getAllMonthCacheKeys().length === 0) {
    migrateLegacyCache()
  }

  const yearPrefix = `${REPORTS_CACHE_PREFIX}:${year}:`
  const monthKeys = getAllMonthCacheKeys().filter(key => key.startsWith(yearPrefix))
  const reports: Report[] = []

  for (const key of monthKeys) {
    const raw = readCacheKey<unknown[]>(key, [])
    if (!Array.isArray(raw)) {
      continue
    }
    reports.push(...raw.map(item => normalizeReport(item as Record<string, unknown>)))
  }

  return sortReports(reports)
}

export function getCachedReportById(id: string): Report | null {
  let monthKeys = getAllMonthCacheKeys()
  if (monthKeys.length === 0) {
    migrateLegacyCache()
    monthKeys = getAllMonthCacheKeys()
  }

  for (const key of monthKeys) {
    const raw = readCacheKey<unknown[]>(key, [])
    if (!Array.isArray(raw)) {
      continue
    }

    for (const item of raw) {
      const report = normalizeReport(item as Record<string, unknown>)
      if (report.id === id) {
        return report
      }
    }
  }

  return null
}

function getFallbackReports(): Report[] {
  return getCachedReports()
}

export async function loadAllReports(): Promise<Report[]> {
  try {
    const payload = await requestJson<{ reports: unknown[] }>('/reports')
    const reports = payload.reports.map(item => normalizeReport(item as Record<string, unknown>))
    writeCache(reports, { replaceMonth: true })
    return sortReports(reports)
  } catch (error) {
    console.warn('No se pudo sincronizar los informes desde el servidor. Usando caché local.', error)
    return getFallbackReports()
  }
}

export async function loadReportsForMonth(month: string, year: number): Promise<Report[]> {
  try {
    const payload = await requestJson<{ reports: unknown[] }>(`/reports?month=${encodeURIComponent(month)}&year=${encodeURIComponent(String(year))}`)
    const reports = payload.reports.map(item => normalizeReport(item as Record<string, unknown>))
    writeCache(reports, { replaceMonth: true })
    return sortReports(reports)
  } catch (error) {
    console.warn('No se pudo sincronizar el mes seleccionado desde el servidor. Usando caché local.', error)
    return sortReports(getCachedReportsForMonth(month, year))
  }
}

export async function uploadEvidenceFile(file: File): Promise<{ filename: string; path: string; url: string }> {
  const formData = new FormData()
  formData.append('file', file)

  const response = await fetch(`${API_BASE_URL}/upload`, {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    const text = await response.text()
    let message = `Error ${response.status}`

    try {
      const payload = JSON.parse(text)
      if (payload?.error) {
        message = payload.error
      }
    } catch {
      // ignore invalid JSON
    }

    throw new Error(`No se pudo subir la imagen: ${message}`)
  }

  return response.json() as Promise<{ filename: string; path: string; url: string }>
}

export async function loadReportWithUpdates(id: string): Promise<Report | null> {
  try {
    const payload = await requestJson<{ report: unknown }>('/reports/' + encodeURIComponent(id))
    const report = normalizeReport(payload.report as Record<string, unknown>)
    writeCache([report], { replaceMonth: false })
    return report
  } catch (error) {
    console.warn('No se pudo cargar el informe desde el servidor. Usando caché local.', error)
    return getCachedReportById(id)
  }
}

export async function createReport(report: Omit<Report, 'id' | 'created_at' | 'updated_at' | 'report_updates'>): Promise<Report> {
  const payload = await requestJson<{ report: unknown }>('/reports', {
    method: 'POST',
    body: JSON.stringify(normalizeReportPayload(report)),
  })

  const created = normalizeReport(payload.report as Record<string, unknown>)
  writeCache([created], { replaceMonth: false })
  return created
}

export async function createReports(reports: Array<Omit<Report, 'id' | 'created_at' | 'updated_at' | 'report_updates'>>): Promise<Report[]> {
  if (reports.length === 0) {
    return []
  }

  const payload = await requestJson<{ reports: unknown[] }>('/reports/bulk', {
    method: 'POST',
    body: JSON.stringify({
      reports: reports.map(report => normalizeReportPayload(report)),
    }),
  })

  const created = payload.reports.map(item => normalizeReport(item as Record<string, unknown>))
  writeCache(created, { replaceMonth: false })
  return created
}

export async function deleteReport(id: string): Promise<void> {
  await requestJson<{ ok: boolean }>('/reports/' + encodeURIComponent(id), {
    method: 'DELETE',
  })

  const existing = getCachedReportById(id)
  if (existing) {
    const key = monthCacheKey(existing.month, existing.year)
    const remaining = getCachedReportsForMonth(existing.month, existing.year).filter(report => report.id !== id)
    if (remaining.length > 0) {
      replaceCacheReports(key, remaining)
    } else if (typeof window !== 'undefined') {
      window.localStorage.removeItem(key)
    }
  }
}

export async function updateReport(id: string, changes: Partial<Report>): Promise<Report> {
  const payload = await requestJson<{ report: unknown }>('/reports/' + encodeURIComponent(id), {
    method: 'PATCH',
    body: JSON.stringify(changes),
  })

  const updated = normalizeReport(payload.report as Record<string, unknown>)
  writeCache([updated], { replaceMonth: false })
  return updated
}

export async function addReportUpdate(reportId: string, payload: Omit<ReportUpdate, 'id' | 'report_id' | 'created_at'>): Promise<ReportUpdate> {
  const response = await requestJson<{ update: unknown }>('/reports/' + encodeURIComponent(reportId) + '/updates', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

  const update = normalizeUpdate(response.update as Record<string, unknown>)

  const current = getCachedReportById(reportId)
  if (current) {
    current.status = payload.status
    current.updated_at = update.created_at
    current.report_updates = [...(current.report_updates ?? []), update]
    writeCache([current], { replaceMonth: false })
  }

  return update
}

export async function countReportsByEmail(email: string): Promise<number> {
  try {
    const payload = await requestJson<{ count: number }>(`/reports/count?email=${encodeURIComponent(email)}`)
    return payload.count
  } catch (error) {
    console.warn('No se pudo contar informes desde el servidor. Usando caché local.', error)
    const normalized = email.trim().toLowerCase()
    return getFallbackReports().filter(report => report.created_by_email.toLowerCase() === normalized).length
  }
}
