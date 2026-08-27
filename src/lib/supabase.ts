import { createClient } from '@supabase/supabase-js'

// Supabase client instance
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || '',
  import.meta.env.VITE_SUPABASE_ANON_KEY || ''
)

export type ServiceType =
  | 'Grua por Averia'
  | 'Inspeccion'
  | 'Grua por Accidente'
  | 'Cerrajeria Vial'
  | 'Paso de Corriente'
  | 'Cambio de Neumatico'
  | 'Abasto de Combustible'
  | 'Extraccion o Maniobra'
  | 'Informacion'

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
  'Abasto de Combustible',
  'Extraccion o Maniobra',
  'Informacion',
]

export const REPORT_STATUSES: ReportStatus[] = [
  'Seguimiento de caso',
  'Caso Finalizado',
  'Falta de Informacion',
  'Informativo',
  'Validacion',
  'Cotizacion',
]

export function normalizeReportStatus(value: unknown): ReportStatus {
  const status = typeof value === 'string' ? value.trim() : ''
  return REPORT_STATUSES.includes(status as ReportStatus)
    ? status as ReportStatus
    : 'Seguimiento de caso'
}

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
  status: ReportStatus
  observation_comment: string
  evidence_url?: string | null
  evidence_filename?: string | null
  evidence_path?: string | null
  evidence_urls?: EvidenceImage[] | null
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
  status: ReportStatus
  comment: string
  added_by: string | null
  added_by_name: string
  added_by_email: string
  created_at: string
}

export interface EvidenceImage {
  url: string
  filename: string
  path: string
}

export const getDefaultApiBase = () => {
  if (import.meta.env.VITE_API_BASE_URL) return import.meta.env.VITE_API_BASE_URL
  return 'https://intelasist.onrender.com'
}
const API_BASE_URL = getDefaultApiBase()
const LEGACY_REPORTS_CACHE_KEY = 'intelasist-shared-reports-cache-v1'
const LEGACY_REPORTS_CACHE_PREFIX = 'intelasist-shared-reports-cache-v2:'

function removeLegacyReportsCache() {
  if (typeof window === 'undefined') {
    return
  }

  try {
    const keysToRemove: string[] = [LEGACY_REPORTS_CACHE_KEY]
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index)
      if (key?.startsWith(LEGACY_REPORTS_CACHE_PREFIX)) {
        keysToRemove.push(key)
      }
    }

    for (const key of keysToRemove) {
      window.localStorage.removeItem(key)
    }
  } catch {
    // El almacenamiento local puede estar bloqueado por el navegador.
  }
}

removeLegacyReportsCache()

function createId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function sortReports(reports: Report[]) {
  return [...reports].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
}

function normalizeUpdate(raw: Record<string, unknown>): ReportUpdate {
  return {
    id: String(raw.id ?? createId()),
    report_id: String(raw.report_id ?? ''),
    status: normalizeReportStatus(raw.status),
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
    status: normalizeReportStatus(raw.status),
    observation_comment: String(raw.observation_comment ?? ''),
    evidence_url: raw.evidence_url === null || raw.evidence_url === undefined ? null : String(raw.evidence_url),
    evidence_filename: raw.evidence_filename === null || raw.evidence_filename === undefined ? null : String(raw.evidence_filename),
    evidence_path: raw.evidence_path === null || raw.evidence_path === undefined ? null : String(raw.evidence_path),
    evidence_urls: Array.isArray(raw.evidence_urls)
      ? raw.evidence_urls.map((item) => ({
          url: String((item as Record<string, unknown>).url ?? ''),
          filename: String((item as Record<string, unknown>).filename ?? ''),
          path: String((item as Record<string, unknown>).path ?? ''),
        }))
      : raw.evidence_url && raw.evidence_url !== null
        ? [{ url: String(raw.evidence_url), filename: String(raw.evidence_filename ?? ''), path: String(raw.evidence_path ?? '') }]
        : null,
    created_by: raw.created_by === null || raw.created_by === undefined ? null : String(raw.created_by),
    created_by_name: String(raw.created_by_name ?? ''),
    created_by_email: String(raw.created_by_email ?? ''),
    created_at: String(raw.created_at ?? new Date().toISOString()),
    updated_at: String(raw.updated_at ?? raw.created_at ?? new Date().toISOString()),
    report_updates: updates,
  }
}

// Normaliza una fila cruda de la tabla `reports` (p.ej. el payload.new que llega
// por Supabase Realtime) al tipo Report que usa la UI.
export function normalizeReportRecord(raw: Record<string, unknown>): Report {
  return normalizeReport(raw)
}

async function requestJson<T>(path: string, init?: RequestInit, source = 'supabase'): Promise<T> {
  try {
    const startedAt = performance.now()
    console.info('[requestJson] fetch', {
      url: `${API_BASE_URL}${path}`,
      method: init?.method || 'GET',
      source,
      startedAt: Math.round(startedAt),
    })
    const response = await fetch(`${API_BASE_URL}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
      ...init,
    })

    const text = await response.text().catch(() => '')
    let payload: any = null

    if (text && text.trim().startsWith('{')) {
      try {
        payload = JSON.parse(text)
      } catch {
        payload = null
      }
    }

    if (!response.ok) {
      const defaultMessage = response.status === 401
        ? 'Sesión caducada. Por favor inicia sesión nuevamente.'
        : response.status === 403
          ? 'No tienes permisos para realizar esta acción.'
          : response.status === 404
            ? 'No se encontró el recurso solicitado.'
            : response.status >= 500
              ? 'Error en el servidor. Por favor intenta de nuevo más tarde.'
              : `Error ${response.status}. Por favor intenta de nuevo.`

      const message = payload?.error || payload?.message || defaultMessage
      throw new Error(String(message))
    }

    if (text && !payload && response.status !== 204) {
      console.warn('Respuesta no JSON recibida desde el servidor:', text.substring(0, 200))
    }

    console.info('[requestJson] complete', {
      url: `${API_BASE_URL}${path}`,
      method: init?.method || 'GET',
      source,
      durationMs: Math.round(performance.now() - startedAt),
      status: response.status,
    })

    return payload as T
  } catch (error) {
    if (error instanceof Error) {
      throw error
    }

    throw new Error('No se pudo conectar con el servidor. Verifica tu conexión e intenta de nuevo.')
  }
}

function normalizeReportPayload(report: Omit<Report, 'id' | 'created_at' | 'updated_at' | 'report_updates'>) {
  return {
    ...report,
    coverage: report.coverage ?? null,
  }
}

export interface DashboardStats {
  date: string
  total: number
  byStatus: Record<string, number>
}

export async function fetchDashboardStats(date?: string): Promise<DashboardStats> {
  const qs = date ? `?date=${encodeURIComponent(date)}` : ''
  const startedAt = performance.now()
  const payload = await requestJson<DashboardStats>(`/reports/dashboard-stats${qs}`, undefined, 'Dashboard.fetchDashboardStats')
  console.info('[dashboard] KPI processing', { durationMs: Math.round(performance.now() - startedAt) })
  return {
    date: String(payload?.date ?? ''),
    total: Number(payload?.total ?? 0),
    byStatus: (payload?.byStatus ?? {}) as Record<string, number>,
  }
}

export async function loadAllReports(): Promise<Report[]> {
  try {
    const payload = await requestJson<{ reports: unknown[] }>('/reports')
    const reports = payload.reports.map(item => normalizeReport(item as Record<string, unknown>))
    return sortReports(reports)
  } catch (error) {
    console.warn('No se pudo sincronizar los informes desde el servidor.', error)
    return []
  }
}

const REPORTS_CACHE_TTL_MS = 5 * 60 * 1000
const reportsForMonthCache = new Map<string, { reports: Report[]; expiresAt: number }>()
const reportsForMonthInFlight = new Map<string, Promise<Report[]>>()

export async function loadReportsForMonth(month: string, year: number, options?: { force?: boolean; source?: string }): Promise<Report[]> {
  const cacheKey = `${month}:${year}`
  const force = options?.force ?? false
  const source = options?.source ?? 'Dashboard.loadReportsForMonth'
  const cached = reportsForMonthCache.get(cacheKey)
  if (!force && cached && cached.expiresAt > Date.now()) {
    console.info('[supabase] loadReportsForMonth cache hit', { month, year, count: cached.reports.length })
    return cached.reports
  }

  const existingRequest = reportsForMonthInFlight.get(cacheKey)
  if (existingRequest) {
    console.info('[supabase] loadReportsForMonth joined in-flight request', { month, year })
    return existingRequest
  }

  const request = (async () => {
    const startedAt = performance.now()
    try {
      console.info('[supabase] loadReportsForMonth', { month, year })
      const payload = await requestJson<{ reports: unknown[] }>(
        `/reports?month=${encodeURIComponent(month)}&year=${encodeURIComponent(String(year))}`,
        undefined,
        source,
      )
      const normalizedAt = performance.now()
      const reports = payload.reports.map(item => normalizeReport(item as Record<string, unknown>))
      const sortedReports = sortReports(reports)
      reportsForMonthCache.set(cacheKey, { reports: sortedReports, expiresAt: Date.now() + REPORTS_CACHE_TTL_MS })
      console.info('[supabase] loadReportsForMonth result', {
        count: sortedReports.length,
        month,
        year,
        durationMs: Math.round(performance.now() - startedAt),
        processingMs: Math.round(performance.now() - normalizedAt),
      })
      return sortedReports
    } catch (error) {
      console.warn('No se pudo sincronizar el mes seleccionado desde el servidor.', error)
      return []
    } finally {
      reportsForMonthInFlight.delete(cacheKey)
    }
  })()

  reportsForMonthInFlight.set(cacheKey, request)
  return request
}

// ---- Paginación server-side de la lista de informes ----
// Solo se descarga UNA página (por defecto 50 filas) en lugar de todo el mes.
// El servidor devuelve además `total` para los controles de paginación.
export interface ReportsPage {
  reports: Report[]
  total: number
  page: number
  pageSize: number
}

export const REPORTS_PAGE_SIZE = 20

export async function loadReportsPage(params: {
  month: string
  year: number
  page: number
  pageSize?: number
  search?: string
}): Promise<ReportsPage> {
  const { month, year, page } = params
  const pageSize = params.pageSize ?? REPORTS_PAGE_SIZE
  const search = (params.search ?? '').trim()

  const qs = new URLSearchParams({
    month,
    year: String(year),
    page: String(page),
    pageSize: String(pageSize),
  })
  if (search) {
    qs.set('search', search)
  }

  try {
    const payload = await requestJson<{ reports: unknown[]; total: number; page: number; pageSize: number }>(
      `/reports?${qs.toString()}`
    )
    const reports = payload.reports.map(item => normalizeReport(item as Record<string, unknown>))
    return {
      reports: sortReports(reports),
      total: Number(payload.total ?? reports.length),
      page: Number(payload.page ?? page),
      pageSize: Number(payload.pageSize ?? pageSize),
    }
  } catch (error) {
    console.warn('No se pudo cargar la página de informes desde el servidor.', error)
    return {
      reports: [],
      total: 0,
      page,
      pageSize,
    }
  }
}

// ---- Estadísticas por motivo (tarjetas) ----
// Endpoint INDEPENDIENTE de la lista: una sola consulta agregada en el servidor
// que cuenta SOAT, Saldo moroso, etc. sobre TODO el mes (no solo la página).
export interface ReportCategoryStats {
  total: number
  categories: Record<string, number>
}

const REPORT_MOTIVO_KEYWORDS = [
  'SOAT',
  'SALDO MOROSO',
  'RENOVACION NO PAGADA',
  'SERVICIO UTILIZADO',
  'BENEFICIO EN 24H',
  'POLIZA CANCELADA',
  'NO CUBIERTO POR LA POLIZA',
]

export function computeCategoryStatsFromReports(reports: Report[]): ReportCategoryStats {
  const categories: Record<string, number> = {}
  for (const kw of REPORT_MOTIVO_KEYWORDS) {
    categories[kw] = reports.filter(r =>
      r.observation_comment.toLowerCase().includes(kw.toLowerCase()) ||
      r.service_type.toLowerCase().includes(kw.toLowerCase())
    ).length
  }
  categories['OTROS'] = reports.filter(r => {
    const text = `${r.observation_comment} ${r.service_type}`.toUpperCase()
    return REPORT_MOTIVO_KEYWORDS.every(kw => !text.includes(kw))
  }).length
  return { total: reports.length, categories }
}

export async function fetchReportCategoryStats(month: string, year: number): Promise<ReportCategoryStats> {
  const qs = new URLSearchParams({ month, year: String(year) })
  try {
    const payload = await requestJson<{ total: number; categories: Record<string, number> }>(
      `/reports/category-stats?${qs.toString()}`
    )
    return {
      total: Number(payload?.total ?? 0),
      categories: (payload?.categories ?? {}) as Record<string, number>,
    }
  } catch (error) {
    console.warn('No se pudieron obtener las estadísticas de categorías desde el servidor.', error)
    return { total: 0, categories: {} }
  }
}

export async function uploadEvidenceFile(file: File): Promise<{ filename: string; path: string; url: string }> {
  if (!file) {
    throw new Error('No se recibió ningún archivo para subir.')
  }

  console.info('[uploadEvidenceFile] archivo recibido:', {
    name: file.name,
    size: file.size,
    type: file.type,
    lastModified: file.lastModified,
  })

  if (file.size === 0) {
    throw new Error('El archivo tiene tamaño 0.')
  }

  const formData = new FormData()
  formData.append('file', file)

  try {
    console.info('[uploadEvidenceFile] Enviando petición a:', `${API_BASE_URL}/upload`)
    const response = await fetch(`${API_BASE_URL}/upload`, {
      method: 'POST',
      body: formData,
    })

    const text = await response.text().catch(() => '')
    console.info('[uploadEvidenceFile] respuesta del servidor:', {
      status: response.status,
      contentType: response.headers.get('content-type'),
    })

    const payload = text && text.trim().startsWith('{') ? JSON.parse(text) : null

    if (!response.ok) {
      const message = payload?.error || payload?.message || `Error ${response.status}`
      throw new Error(`No se pudo subir la imagen: ${message}`)
    }

    return payload as { filename: string; path: string; url: string }
  } catch (error) {
    if (error instanceof Error) {
      console.error('[uploadEvidenceFile] Error al subir la imagen:', error)
      throw error
    }
    console.error('[uploadEvidenceFile] Error desconocido al subir la imagen:', error)
    throw new Error('No se pudo subir la imagen. Verifica tu conexión e intenta de nuevo.')
  }
}

export async function loadReportWithUpdates(id: string): Promise<Report | null> {
  try {
    const payload = await requestJson<{ report: unknown }>('/reports/' + encodeURIComponent(id))
    const report = normalizeReport(payload.report as Record<string, unknown>)
    return report
  } catch (error) {
    console.warn('No se pudo cargar el informe desde el servidor.', error)
    return null
  }
}

export async function createReport(report: Omit<Report, 'id' | 'created_at' | 'updated_at' | 'report_updates'>): Promise<Report> {
  const payload = await requestJson<{ report: unknown }>('/reports', {
    method: 'POST',
    body: JSON.stringify(normalizeReportPayload(report)),
  })

  const created = normalizeReport(payload.report as Record<string, unknown>)
  reportsForMonthCache.delete(`${created.month}:${created.year}`)
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
  created.forEach(report => reportsForMonthCache.delete(`${report.month}:${report.year}`))
  return created
}

export async function deleteReport(id: string): Promise<void> {
  await requestJson<{ ok: boolean }>('/reports/' + encodeURIComponent(id), {
    method: 'DELETE',
  })
  reportsForMonthCache.clear()
}

export async function updateReport(id: string, changes: Partial<Report>): Promise<Report> {
  const payload = await requestJson<{ report: unknown }>('/reports/' + encodeURIComponent(id), {
    method: 'PATCH',
    body: JSON.stringify(changes),
  })

  const updated = normalizeReport(payload.report as Record<string, unknown>)
  reportsForMonthCache.clear()
  return updated
}

export async function addReportUpdate(reportId: string, payload: Omit<ReportUpdate, 'id' | 'report_id' | 'created_at'>): Promise<ReportUpdate> {
  const response = await requestJson<{ update: unknown }>('/reports/' + encodeURIComponent(reportId) + '/updates', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

  const update = normalizeUpdate(response.update as Record<string, unknown>)

  return update
}

export async function countReportsByEmail(email: string): Promise<number> {
  try {
    const payload = await requestJson<{ count: number }>(`/reports/count?email=${encodeURIComponent(email)}`)
    return payload.count
  } catch (error) {
    console.warn('No se pudo contar informes desde el servidor.', error)
    return 0
  }
}
