import * as React from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  MONTHS,
  type Report,
  type ReportCategoryStats,
  loadReportsForMonth,
  loadReportsPage,
  fetchReportCategoryStats,
  computeCategoryStatsFromReports,
  getCachedReportsForMonth,
  normalizeReportRecord,
  cacheReports,
  REPORTS_PAGE_SIZE,
} from '@/lib/supabase'
import { useRealtimeReports } from '@/hooks/useRealtime'
import type { RealtimeEvent } from '@/lib/realtime-service'
import { useAuth, canDeleteReports } from '@/lib/auth'
import { usePermissions } from '@/lib/permissions-context'
import type { PermissionKey } from '@/lib/permissions'
import { TrashService } from '@/lib/trash-service'
import { PERMISSIONS } from '@/lib/permissions'
import { FilePlus, Download, Search, Eye, Trash2, Shield, AlertCircle, Clock, CheckCircle2, Zap, XCircle, FileText, Pencil, ChevronLeft, ChevronRight } from 'lucide-react'
import * as XLSX from 'xlsx'

const STATUS_BADGE: Record<string, string> = {
  'Caso Finalizado': 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-1 ring-inset ring-emerald-500/20',
  'Seguimiento de caso': 'bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-1 ring-inset ring-amber-500/20',
  'Falta de Informacion': 'bg-destructive/10 text-destructive ring-1 ring-inset ring-destructive/20',
  'Informativo': 'bg-sky-500/10 text-sky-600 dark:text-sky-400 ring-1 ring-inset ring-sky-500/20',
  'Validacion': 'bg-violet-500/10 text-violet-600 dark:text-violet-400 ring-1 ring-inset ring-violet-500/20',
  'Cotizacion': 'bg-blue-500/10 text-blue-600 dark:text-blue-400 ring-1 ring-inset ring-blue-500/20',
}

// Orden y palabras clave de los "motivos" mostrados en las tarjetas. Debe coincidir
// con el backend (/reports/category-stats) y con computeCategoryStatsFromReports.
const MOTIVO_ORDER = [
  'SOAT',
  'SALDO MOROSO',
  'RENOVACION NO PAGADA',
  'SERVICIO UTILIZADO',
  'BENEFICIO EN 24H',
  'POLIZA CANCELADA',
  'NO CUBIERTO POR LA POLIZA',
  'OTROS',
]

const MOTIVO_KEYWORDS = MOTIVO_ORDER.filter(motivo => motivo !== 'OTROS')

// Metadatos visuales de cada tarjeta de categoría (mismo orden/diseño que antes).
const CATEGORY_META: Array<{ label: string; chip: string; icon: React.ComponentType<{ className?: string }> }> = [
  { label: 'SOAT', chip: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 ring-sky-500/20', icon: Shield },
  { label: 'SALDO MOROSO', chip: 'bg-red-500/10 text-red-600 dark:text-red-400 ring-red-500/20', icon: AlertCircle },
  { label: 'RENOVACION NO PAGADA', chip: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 ring-orange-500/20', icon: Clock },
  { label: 'SERVICIO UTILIZADO', chip: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-emerald-500/20', icon: CheckCircle2 },
  { label: 'BENEFICIO EN 24H', chip: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 ring-violet-500/20', icon: Zap },
  { label: 'POLIZA CANCELADA', chip: 'bg-muted text-muted-foreground ring-border', icon: XCircle },
  { label: 'NO CUBIERTO POR LA POLIZA', chip: 'bg-muted text-muted-foreground ring-border', icon: XCircle },
  { label: 'OTROS', chip: 'bg-muted text-muted-foreground ring-border', icon: FileText },
]

// ---- Helpers puros (a nivel de módulo para no recrearse en cada render) ----

function formatDateTimeWithMeridiem(timestamp: string) {
  const date = new Date(timestamp)
  const datePart = date.toLocaleDateString('es', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
  const timePart = date.toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', hour12: true,
  })
  return `${datePart} ${timePart}`
}

function getDaysInMonth(month: string, year: number): number {
  const monthIndex = MONTHS.indexOf(month)
  return new Date(year, monthIndex + 1, 0).getDate()
}

function getReportMotivo(report: Report) {
  const text = `${report.observation_comment} ${report.service_type}`.toUpperCase()
  const found = MOTIVO_KEYWORDS.find(motivo => text.includes(motivo))
  return found ?? 'OTROS'
}

function sortReportsByMotivo(a: Report, b: Report) {
  const indexA = MOTIVO_ORDER.indexOf(getReportMotivo(a))
  const indexB = MOTIVO_ORDER.indexOf(getReportMotivo(b))
  if (indexA !== indexB) {
    return indexA - indexB
  }
  return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
}

function filterReportsByDateRange(reports: Report[], fromDay: number, toDay: number, month: string, year: number): Report[] {
  return reports.filter(r => {
    const createdDate = new Date(r.created_at)
    const day = createdDate.getDate()
    const rMonth = MONTHS[createdDate.getMonth()]
    const rYear = createdDate.getFullYear()
    return rYear === year && rMonth === month && day >= fromDay && day <= toDay
  })
}

// ---- Fila de tabla y tarjeta móvil memoizadas ----
// React.memo evita re-renderizar las 50 filas en cada pulsación del buscador
// (solo cambian cuando cambia su propio `report`/`isDeleting`).

interface RowActionProps {
  report: Report
  canView: boolean
  canEdit: boolean
  canDelete: boolean
  isDeleting: boolean
  onView: (id: string) => void
  onEdit: (id: string) => void
  onDelete: (id: string) => void
}

const ReportRowActions = React.memo(function ReportRowActions({ report, canView, canEdit, canDelete, isDeleting, onView, onEdit, onDelete }: RowActionProps) {
  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={e => { e.stopPropagation(); onView(report.id) }}
        disabled={!canView}
        title={!canView ? 'No tienes permiso para ver informes' : 'Ver'}
      >
        <Eye className="size-4" />
      </Button>
      {canEdit ? (
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={e => { e.stopPropagation(); onEdit(report.id) }}
          title="Editar informe"
        >
          <Pencil className="size-4" />
        </Button>
      ) : null}
      {canDelete ? (
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-destructive hover:text-destructive"
          onClick={e => { e.stopPropagation(); onDelete(report.id) }}
          disabled={isDeleting}
          title="Eliminar informe"
        >
          {isDeleting ? <Spinner className="size-4" /> : <Trash2 className="size-4" />}
        </Button>
      ) : null}
    </>
  )
})

const ReportTableRow = React.memo(function ReportTableRow(props: RowActionProps) {
  const { report, canView, onView } = props
  return (
    <TableRow
      className={`border-border transition-colors hover:bg-accent/8 group ${canView ? 'cursor-pointer' : 'cursor-not-allowed'}`}
      onClick={() => canView && onView(report.id)}
    >
      <TableCell className="px-2 py-1.5 font-medium text-foreground truncate group-hover:text-foreground" title={report.insured_name}>{report.insured_name}</TableCell>
      <TableCell className="px-2 py-1.5 font-mono tabular-nums text-foreground truncate group-hover:text-foreground" title={report.plate}>{report.plate}</TableCell>
      <TableCell className="px-2 py-1.5">
        <Badge variant="outline" className="max-w-full truncate text-xs" title={report.service_type}>{report.service_type}</Badge>
      </TableCell>
      <TableCell className="px-2 py-1.5 text-muted-foreground group-hover:text-foreground truncate" title={report.coverage && report.coverage.trim() ? report.coverage : 'No'}>{report.coverage && report.coverage.trim() ? report.coverage : 'No'}</TableCell>
      <TableCell className="px-2 py-1.5 text-muted-foreground group-hover:text-foreground truncate" title={`${report.brand} ${report.model}`}>{report.brand} {report.model}</TableCell>
      <TableCell className="px-2 py-1.5">
        <Badge className={`max-w-full truncate text-xs font-medium ${STATUS_BADGE[report.status] ?? 'bg-secondary text-secondary-foreground ring-1 ring-inset ring-border'}`} title={report.status}>{report.status}</Badge>
      </TableCell>
      <TableCell className="px-2 py-1.5 text-muted-foreground group-hover:text-foreground truncate" title={report.created_by_name || report.created_by_email}>{report.created_by_name || report.created_by_email}</TableCell>
      <TableCell className="px-2 py-1.5 text-xs text-muted-foreground group-hover:text-foreground tabular-nums truncate" title={formatDateTimeWithMeridiem(report.created_at)}>{formatDateTimeWithMeridiem(report.created_at)}</TableCell>
      <TableCell className="px-2 py-1.5 text-right">
        <div className="flex justify-end gap-0.5">
          <ReportRowActions {...props} />
        </div>
      </TableCell>
    </TableRow>
  )
})

const ReportMobileCard = React.memo(function ReportMobileCard(props: RowActionProps) {
  const { report, canView, onView } = props
  return (
    <div
      role={canView ? 'button' : undefined}
      tabIndex={canView ? 0 : undefined}
      onClick={() => canView && onView(report.id)}
      onKeyDown={e => { if (canView && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onView(report.id) } }}
      className={`p-4 space-y-3 transition-colors hover:bg-accent ${canView ? 'cursor-pointer' : 'cursor-not-allowed'}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-sm text-foreground truncate">{report.insured_name}</p>
          <p className="text-xs font-mono tabular-nums text-muted-foreground">{report.plate}</p>
        </div>
        <Badge className={`shrink-0 text-xs font-medium ${STATUS_BADGE[report.status] ?? 'bg-secondary text-secondary-foreground ring-1 ring-inset ring-border'}`}>{report.status}</Badge>
      </div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
        <div className="min-w-0">
          <dt className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Servicio</dt>
          <dd className="mt-0.5"><Badge variant="outline" className="max-w-full truncate text-xs">{report.service_type}</Badge></dd>
        </div>
        <div className="min-w-0">
          <dt className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Cobertura</dt>
          <dd className="text-foreground truncate">{report.coverage && report.coverage.trim() ? report.coverage : 'No'}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Vehículo</dt>
          <dd className="text-foreground truncate">{report.brand} {report.model}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Creado por</dt>
          <dd className="text-foreground truncate">{report.created_by_name || report.created_by_email}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Fecha</dt>
          <dd className="text-muted-foreground tabular-nums">{formatDateTimeWithMeridiem(report.created_at)}</dd>
        </div>
      </dl>
      <div className="flex justify-end gap-1 border-t border-border pt-3">
        <ReportRowActions {...props} />
      </div>
    </div>
  )
})

const EMPTY_STATS: ReportCategoryStats = { total: 0, categories: {} }

export default function ReportsList() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user } = useAuth()
  const { hasPermission } = usePermissions()
  const canViewReports = hasPermission(PERMISSIONS.REPORTS.VIEW as PermissionKey) || hasPermission(PERMISSIONS.REPORTS.VIEW_ALL as PermissionKey)
  const canCreateReports = hasPermission(PERMISSIONS.REPORTS.CREATE as PermissionKey)
  const canExportReports = hasPermission(PERMISSIONS.REPORTS.EXPORT as PermissionKey)
  const canDeleteReportsPermission = canDeleteReports(user) && hasPermission(PERMISSIONS.REPORTS.DELETE as PermissionKey)
  // La edición de informes ya creados requiere el permiso de gestión de permisos.
  const canEditReportsPermission = hasPermission(PERMISSIONS.SYSTEM.MANAGE_PERMISSIONS as PermissionKey)

  const currentYear = new Date().getFullYear()
  const currentMonthIdx = new Date().getMonth()

  const selectedMonth = searchParams.get('month') ?? MONTHS[currentMonthIdx]
  const selectedYear = parseInt(searchParams.get('year') ?? String(currentYear))

  // Semilla cache-first: pinta la primera página y las tarjetas desde la caché
  // local (si existe) mientras llega la respuesta del servidor.
  const seedCached = React.useMemo(
    () => getCachedReportsForMonth(selectedMonth, selectedYear),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const [reports, setReports] = React.useState<Report[]>(() => seedCached.slice(0, REPORTS_PAGE_SIZE))
  const [total, setTotal] = React.useState(seedCached.length)
  const [stats, setStats] = React.useState<ReportCategoryStats>(() =>
    seedCached.length > 0 ? computeCategoryStatsFromReports(seedCached) : EMPTY_STATS,
  )
  const [page, setPage] = React.useState(1)
  const [search, setSearch] = React.useState('')
  const [debouncedSearch, setDebouncedSearch] = React.useState('')
  const [loading, setLoading] = React.useState(seedCached.length === 0)
  const [reloadKey, setReloadKey] = React.useState(0)

  const [deletingReportId, setDeletingReportId] = React.useState<string | null>(null)
  const [deleteError, setDeleteError] = React.useState<string | null>(null)
  const [showExportModal, setShowExportModal] = React.useState(false)
  const [exportMode, setExportMode] = React.useState<'full' | 'range' | null>(null)
  const [exporting, setExporting] = React.useState(false)
  const [exportError, setExportError] = React.useState<string | null>(null)
  const [dayFrom, setDayFrom] = React.useState('1')
  const [dayTo, setDayTo] = React.useState('31')

  const isMountedRef = React.useRef(true)
  const refreshTimerRef = React.useRef<number | null>(null)

  React.useEffect(() => {
    return () => {
      isMountedRef.current = false
      if (refreshTimerRef.current) {
        window.clearTimeout(refreshTimerRef.current)
      }
    }
  }, [])

  // Si la URL contiene ?export=1 abrimos el modal de export (si tiene permiso)
  React.useEffect(() => {
    try {
      if (searchParams.get('export') === '1' && canExportReports) {
        setShowExportModal(true)

        // Eliminamos el parámetro para que no se reabra al navegar
        const next = new URLSearchParams(searchParams)
        next.delete('export')
        setSearchParams(next)
      }
    } catch {
      // noop
    }
  }, [searchParams, canExportReports, setSearchParams])

  const pageSize = REPORTS_PAGE_SIZE
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  // Debounce del buscador: al confirmar el término (300ms) se busca en el
  // servidor sobre TODO el mes y se vuelve a la página 1.
  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim())
      setPage(1)
    }, 300)
    return () => window.clearTimeout(timer)
  }, [search])

  // Al cambiar de mes/año se vuelve a la página 1.
  React.useEffect(() => {
    setPage(1)
  }, [selectedMonth, selectedYear])

  // Carga de la PÁGINA actual (50 filas) — server-side, sin traer todo el mes.
  React.useEffect(() => {
    let cancelled = false
    setLoading(true)
    loadReportsPage({ month: selectedMonth, year: selectedYear, page, pageSize, search: debouncedSearch })
      .then(res => {
        if (cancelled || !isMountedRef.current) return
        setReports(res.reports)
        setTotal(res.total)
      })
      .catch(error => {
        console.error('Error cargando informes:', error)
      })
      .finally(() => {
        if (!cancelled && isMountedRef.current) {
          setLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [selectedMonth, selectedYear, page, pageSize, debouncedSearch, reloadKey])

  // Tarjetas de estadísticas — endpoint INDEPENDIENTE, sobre todo el mes.
  React.useEffect(() => {
    let cancelled = false
    fetchReportCategoryStats(selectedMonth, selectedYear)
      .then(next => {
        if (!cancelled && isMountedRef.current) {
          setStats(next)
        }
      })
      .catch(error => {
        console.error('Error cargando estadísticas:', error)
      })
    return () => { cancelled = true }
  }, [selectedMonth, selectedYear, reloadKey])

  // Si el total se reduce (borrado/búsqueda) y la página actual queda fuera de
  // rango, se ajusta a la última página válida.
  React.useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages)
    }
  }, [page, totalPages])

  // Realtime: refresco coalescido de la página + estadísticas cuando llega un
  // cambio del mes visible. Sin polling (los eventos son baratos).
  const scheduleRefresh = React.useCallback(() => {
    if (refreshTimerRef.current) return
    refreshTimerRef.current = window.setTimeout(() => {
      refreshTimerRef.current = null
      if (isMountedRef.current) {
        setReloadKey(k => k + 1)
      }
    }, 500)
  }, [])

  const handleRealtimeReport = React.useCallback((event: RealtimeEvent<any>) => {
    if (event.type === 'INSERT' || event.type === 'UPDATE') {
      const incoming = normalizeReportRecord(event.record as Record<string, unknown>)
      cacheReports([incoming])
      if (incoming.month === selectedMonth && incoming.year === selectedYear) {
        scheduleRefresh()
      }
    } else if (event.type === 'DELETE') {
      scheduleRefresh()
    }
  }, [selectedMonth, selectedYear, scheduleRefresh])

  useRealtimeReports(handleRealtimeReport)

  // Tarjetas de categoría (memoizadas) a partir de las estadísticas del servidor.
  const categories = React.useMemo(
    () => CATEGORY_META.map(meta => ({
      ...meta,
      count: stats.categories[meta.label] ?? 0,
    })),
    [stats],
  )

  // Callbacks estables para las filas memoizadas.
  const handleView = React.useCallback((id: string) => {
    if (canViewReports) navigate(`/informes/${id}`)
  }, [canViewReports, navigate])

  const handleEdit = React.useCallback((id: string) => {
    navigate(`/informes/${id}/editar`)
  }, [navigate])

  const handleDeleteReport = React.useCallback(async (reportId: string) => {
    if (!canDeleteReports(user) || !hasPermission(PERMISSIONS.REPORTS.DELETE as PermissionKey)) {
      if (isMountedRef.current) {
        setDeleteError('No tienes permisos para eliminar informes.')
      }
      return
    }

    if (!isMountedRef.current) return

    setDeletingReportId(reportId)
    setDeleteError(null)

    try {
      // Soft-delete con auditoría (TrashService), igual que antes.
      await TrashService.moveToTrash(reportId, { id: reportId }, 'Manual deletion')
      if (isMountedRef.current) {
        setDeletingReportId(null)
        // Refresca la página actual y las estadísticas tras eliminar.
        setReloadKey(k => k + 1)
      }
    } catch (error) {
      if (isMountedRef.current) {
        setDeletingReportId(null)
        setDeleteError(error instanceof Error ? error.message : 'No se pudo eliminar el informe.')
      }
    }
  }, [user, hasPermission])

  const performExport = React.useCallback((dataToExport: Report[], fileName: string) => {
    const orderedReports = [...dataToExport].sort(sortReportsByMotivo)
    const rows = orderedReports.map(r => ({
      'Mes': r.month,
      'Año': r.year,
      'Asegurado': r.insured_name,
      'Placa': r.plate,
      'Póliza': r.policy,
      'Servicio': r.service_type,
      'Marca': r.brand,
      'Modelo': r.model,
      'Color': r.color,
      'Año Vehículo': r.year_vehicle ?? '',
      'Estado': r.status,
      'Observación': r.observation_comment,
      'Creado por': r.created_by_name,
      'Email': r.created_by_email,
      'Fecha Creación': formatDateTimeWithMeridiem(r.created_at),
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, `${selectedMonth} ${selectedYear}`)
    XLSX.writeFile(wb, fileName)
    setShowExportModal(false)
    setExportMode(null)
  }, [selectedMonth, selectedYear])

  // Exportar SIEMPRE descarga el mes completo del servidor (100% de los
  // registros), independientemente de la página/búsqueda mostrada en la tabla.
  const handleExportFull = React.useCallback(async () => {
    setExporting(true)
    setExportError(null)
    try {
      const all = await loadReportsForMonth(selectedMonth, selectedYear)
      performExport(all, `Informes_${selectedMonth}_${selectedYear}.xlsx`)
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'No se pudo exportar. Intenta de nuevo.')
    } finally {
      setExporting(false)
    }
  }, [selectedMonth, selectedYear, performExport])

  const handleExportRange = React.useCallback(async () => {
    const fromDay = parseInt(dayFrom) || 1
    const toDay = parseInt(dayTo) || getDaysInMonth(selectedMonth, selectedYear)

    if (fromDay < 1 || toDay < 1 || fromDay > toDay) {
      alert('Por favor ingresa un rango válido de días')
      return
    }

    setExporting(true)
    setExportError(null)
    try {
      const all = await loadReportsForMonth(selectedMonth, selectedYear)
      const filteredRange = filterReportsByDateRange(all, fromDay, toDay, selectedMonth, selectedYear)
      performExport(filteredRange, `Informes_${selectedMonth}_${selectedYear}_${fromDay}-${toDay}.xlsx`)
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'No se pudo exportar. Intenta de nuevo.')
    } finally {
      setExporting(false)
    }
  }, [dayFrom, dayTo, selectedMonth, selectedYear, performExport])

  const years = React.useMemo(() => Array.from({ length: 5 }, (_, i) => currentYear - 2 + i), [currentYear])

  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1
  const rangeEnd = Math.min(page * pageSize, total)

  if (!canViewReports) {
    return (
      <div className="mx-auto max-w-4xl p-6 text-center">
        <div className="glass-panel relative overflow-hidden rounded-[1.5rem] p-8">
          <span className="brand-gradient-bg pointer-events-none absolute inset-x-0 top-0 h-1 opacity-80" aria-hidden="true" />
          <span className="mx-auto mb-4 flex size-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive ring-1 ring-destructive/20">
            <Shield className="size-6" />
          </span>
          <p className="text-lg font-semibold text-destructive">No tienes permisos para ver informes.</p>
          <p className="mt-2 text-sm text-muted-foreground">Solicita a un administrador el permiso correspondiente.</p>
          <div className="mt-4 flex justify-center">
            {canCreateReports && (
              <Button
                variant="outline"
                onClick={() => navigate('/informes/nuevo')}
              >
                Crear informe
              </Button>
            )}
          </div>
        </div>
      </div>
    )
  }

  const rowProps = (report: Report): RowActionProps => ({
    report,
    canView: canViewReports,
    canEdit: canEditReportsPermission,
    canDelete: canDeleteReportsPermission,
    isDeleting: deletingReportId === report.id,
    onView: handleView,
    onEdit: handleEdit,
    onDelete: handleDeleteReport,
  })

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-6">
      {/* Header */}
      <div className="glass-panel relative overflow-hidden rounded-[1.5rem] p-5 sm:p-6">
        <span className="brand-gradient-bg pointer-events-none absolute inset-x-0 top-0 h-1 opacity-80" aria-hidden="true" />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="brand-monogram flex size-12 shrink-0 items-center justify-center rounded-2xl" aria-hidden="true">
              <FileText className="size-5" />
            </span>
            <div>
              <p className="mb-1.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                <span className="brand-gradient-bg size-1.5 rounded-full" aria-hidden="true" />
                Informes
              </p>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Informes</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {total} informe{total !== 1 ? 's' : ''} en {selectedMonth} {selectedYear}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {canExportReports && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowExportModal(true)}
                disabled={stats.total === 0}
                className="gap-2"
              >
                <Download className="size-4" />
                Exportar Excel
              </Button>
            )}
            {hasPermission(PERMISSIONS.REPORTS.CREATE as PermissionKey) && (
              <Button
                size="sm"
                onClick={() => navigate('/informes/nuevo')}
                className="gap-2 bg-destructive hover:bg-destructive/90 text-white"
              >
                <FilePlus className="size-4" />
                Nuevo Informe
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Categories Palette */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {/* Total de Informes */}
        <Card className="dashboard-soft-surface relative overflow-hidden rounded-[1.35rem] border">
          <span className="brand-gradient-bg absolute inset-x-0 top-0 h-0.5" aria-hidden="true" />
          <CardContent className="p-4">
            <div className="flex flex-col items-center gap-2 text-center">
              <span className="flex size-10 items-center justify-center rounded-xl ring-1 brand-monogram ring-transparent">
                <FileText className="size-5" />
              </span>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Total de Informes</p>
              <p className="text-3xl font-bold tabular-nums text-foreground">{stats.total}</p>
            </div>
          </CardContent>
        </Card>

        {categories.map(cat => {
          const IconComponent = cat.icon
          return (
            <Card key={cat.label} className="dashboard-soft-surface rounded-[1.35rem] border">
              <CardContent className="p-4">
                <div className="flex flex-col items-center gap-2 text-center">
                  <span className={`flex size-10 items-center justify-center rounded-xl ring-1 ${cat.chip}`}>
                    <IconComponent className="size-5" />
                  </span>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{cat.label}</p>
                  <p className="text-3xl font-bold tabular-nums text-foreground">{cat.count}</p>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Filters */}
      <div className="glass-panel flex flex-wrap gap-3 rounded-[1.35rem] p-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por asegurado, placa, póliza..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={selectedMonth}
          onValueChange={v => { setPage(1); setSearchParams({ month: v, year: String(selectedYear) }) }}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MONTHS.map(m => (
              <SelectItem key={m} value={m}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={String(selectedYear)}
          onValueChange={v => { setPage(1); setSearchParams({ month: selectedMonth, year: v }) }}
        >
          <SelectTrigger className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map(y => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card className="glass-panel overflow-hidden rounded-[1.35rem] border">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <span className="brand-gradient-bg size-1.5 rounded-full" aria-hidden="true" />
            {selectedMonth} {selectedYear}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-hidden">
          {deleteError ? (
            <div className="px-4 pt-4">
              <p className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive ring-1 ring-inset ring-destructive/20">
                <AlertCircle className="size-4 shrink-0" />
                {deleteError}
              </p>
            </div>
          ) : null}
          {loading && reports.length === 0 ? (
            <div className="flex justify-center py-12">
              <Spinner className="size-6" />
            </div>
          ) : reports.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <span className="mb-4 flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground ring-1 ring-border">
                <FilePlus className="size-6" />
              </span>
              <p className="text-sm font-semibold text-foreground">
                {debouncedSearch
                  ? `No hay informes que coincidan con "${debouncedSearch}"`
                  : `No hay informes en ${selectedMonth} ${selectedYear}`}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Ajusta los filtros o crea un nuevo informe para empezar.</p>
              {hasPermission(PERMISSIONS.REPORTS.CREATE as PermissionKey) ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => navigate('/informes/nuevo')}
                >
                  Crear informe
                </Button>
              ) : null}
            </div>
          ) : (
            <>
              {/* DESKTOP / TABLET (>=768px): tabla compacta de ancho fijo */}
              <div className="hidden md:block">
                <Table className="w-full table-fixed text-[13px]">
                  <colgroup>
                    <col className="w-[17%]" /> {/* Asegurado */}
                    <col className="w-[9%]" />  {/* Placa */}
                    <col className="w-[12%]" /> {/* Servicio */}
                    <col className="w-[10%]" /> {/* Cobertura */}
                    <col className="w-[13%]" /> {/* Vehículo */}
                    <col className="w-[11%]" /> {/* Estado */}
                    <col className="w-[11%]" /> {/* Creado por */}
                    <col className="w-[9%]" />  {/* Fecha */}
                    <col className="w-[8%]" />  {/* Acciones */}
                  </colgroup>
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableHead className="px-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Asegurado</TableHead>
                      <TableHead className="px-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Placa</TableHead>
                      <TableHead className="px-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Servicio</TableHead>
                      <TableHead className="px-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Cobertura</TableHead>
                      <TableHead className="px-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Vehículo</TableHead>
                      <TableHead className="px-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Estado</TableHead>
                      <TableHead className="px-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Creado por</TableHead>
                      <TableHead className="px-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Fecha</TableHead>
                      <TableHead className="px-2 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reports.map(report => (
                      <ReportTableRow key={report.id} {...rowProps(report)} />
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* MÓVIL (<768px): tarjetas apiladas */}
              <div className="block md:hidden divide-y divide-border">
                {reports.map(report => (
                  <ReportMobileCard key={report.id} {...rowProps(report)} />
                ))}
              </div>
            </>
          )}

          {/* Controles de paginación */}
          {total > 0 ? (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-border px-4 py-3">
              <p className="text-xs text-muted-foreground tabular-nums">
                Mostrando {rangeStart}–{rangeEnd} de {total}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1 || loading}
                >
                  <ChevronLeft className="size-4" />
                  Anterior
                </Button>
                <Select
                  value={String(Math.min(page, totalPages))}
                  onValueChange={v => setPage(Number(v))}
                >
                  <SelectTrigger className="w-[120px]" aria-label="Seleccionar página">
                    <span className="text-xs tabular-nums">Pág. {Math.min(page, totalPages)} / {totalPages}</span>
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                      <SelectItem key={p} value={String(p)}>Página {p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages || loading}
                >
                  Siguiente
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Export Modal */}
      <Dialog open={showExportModal} onOpenChange={open => { setShowExportModal(open); if (!open) { setExportMode(null); setExportError(null) } }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Opciones de Exportación</DialogTitle>
            <DialogDescription>
              Selecciona cómo deseas exportar los informes de {selectedMonth} {selectedYear}
            </DialogDescription>
          </DialogHeader>

          {exportError ? (
            <p className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive ring-1 ring-inset ring-destructive/20">
              <AlertCircle className="size-4 shrink-0" />
              {exportError}
            </p>
          ) : null}

          {exportMode === null ? (
            <div className="space-y-3">
              <Button
                onClick={() => setExportMode('full')}
                className="w-full justify-start h-auto py-3 px-4 text-left"
                variant="outline"
              >
                <div className="text-left">
                  <div className="font-medium">Mes Completo</div>
                  <div className="text-xs text-muted-foreground">
                    Exportar todos los informes del mes
                  </div>
                </div>
              </Button>
              <Button
                onClick={() => setExportMode('range')}
                className="w-full justify-start h-auto py-3 px-4 text-left"
                variant="outline"
              >
                <div className="text-left">
                  <div className="font-medium">Rango de Fechas</div>
                  <div className="text-xs text-muted-foreground">
                    Exportar del día X al día Y del mes
                  </div>
                </div>
              </Button>
            </div>
          ) : exportMode === 'full' ? (
            <div className="space-y-4 py-4">
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm font-medium">Se exportarán todos los informes del mes:</p>
                <p className="text-lg font-bold text-foreground mt-1">
                  {selectedMonth} {selectedYear}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Total de informes: {stats.total}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Desde día</label>
                  <Input
                    type="number"
                    min="1"
                    max={getDaysInMonth(selectedMonth, selectedYear)}
                    value={dayFrom}
                    onChange={e => setDayFrom(e.target.value)}
                    placeholder="1"
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Hasta día</label>
                  <Input
                    type="number"
                    min="1"
                    max={getDaysInMonth(selectedMonth, selectedYear)}
                    value={dayTo}
                    onChange={e => setDayTo(e.target.value)}
                    placeholder={String(getDaysInMonth(selectedMonth, selectedYear))}
                    className="mt-1"
                  />
                </div>
              </div>
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-xs text-muted-foreground">
                  Rango: {dayFrom} - {dayTo} de {selectedMonth} {selectedYear}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Máximo de días en {selectedMonth}: {getDaysInMonth(selectedMonth, selectedYear)}
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowExportModal(false)
                setExportMode(null)
                setExportError(null)
              }}
              disabled={exporting}
            >
              Cancelar
            </Button>
            {exportMode === 'full' ? (
              <Button onClick={handleExportFull} disabled={exporting} className="gap-2">
                {exporting ? <Spinner className="size-4" /> : null}
                Exportar
              </Button>
            ) : exportMode === 'range' ? (
              <Button onClick={handleExportRange} disabled={exporting} className="gap-2">
                {exporting ? <Spinner className="size-4" /> : null}
                Exportar
              </Button>
            ) : (
              <Button onClick={() => setExportMode(null)}>
                Atrás
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
