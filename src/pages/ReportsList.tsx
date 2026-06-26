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
import { MONTHS, type Report, loadReportsForMonth, deleteReport, getCachedReportsForMonth, normalizeReportRecord, cacheReports } from '@/lib/supabase'
import { useRealtimeReports } from '@/hooks/useRealtime'
import type { RealtimeEvent } from '@/lib/realtime-service'
import { useAuth, canDeleteReports } from '@/lib/auth'
import { usePermissions } from '@/lib/permissions-context'
import type { PermissionKey } from '@/lib/permissions'
import { AuditService } from '@/lib/audit-service'
import { TrashService } from '@/lib/trash-service'
import { PERMISSIONS } from '@/lib/permissions'
import { FilePlus, Download, Search, Eye, Trash2, Shield, AlertCircle, Clock, CheckCircle2, Zap, XCircle, FileText, Pencil } from 'lucide-react'
import * as XLSX from 'xlsx'

const STATUS_BADGE: Record<string, string> = {
  'Caso Finalizado': 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-1 ring-inset ring-emerald-500/20',
  'Seguimiento de caso': 'bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-1 ring-inset ring-amber-500/20',
  'Falta de Informacion': 'bg-destructive/10 text-destructive ring-1 ring-inset ring-destructive/20',
  'Informativo': 'bg-sky-500/10 text-sky-600 dark:text-sky-400 ring-1 ring-inset ring-sky-500/20',
  'Validacion': 'bg-violet-500/10 text-violet-600 dark:text-violet-400 ring-1 ring-inset ring-violet-500/20',
  'Cotizacion': 'bg-blue-500/10 text-blue-600 dark:text-blue-400 ring-1 ring-inset ring-blue-500/20',
}


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

  const cachedReports = getCachedReportsForMonth(selectedMonth, selectedYear)
  const [reports, setReports] = React.useState<Report[]>(cachedReports)
  const [loading, setLoading] = React.useState(cachedReports.length === 0)
  const [search, setSearch] = React.useState('')
  const [deletingReportId, setDeletingReportId] = React.useState<string | null>(null)
  const [deleteError, setDeleteError] = React.useState<string | null>(null)
  const [showExportModal, setShowExportModal] = React.useState(false)
  const [exportMode, setExportMode] = React.useState<'full' | 'range' | null>(null)
  const [dayFrom, setDayFrom] = React.useState('1')
  const [dayTo, setDayTo] = React.useState('31')
  const isMountedRef = React.useRef(true)

  React.useEffect(() => {
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const loadReports = React.useCallback(async (month: string, year: number, showSpinner = true) => {
    if (!isMountedRef.current) {
      return []
    }
    if (showSpinner) {
      setLoading(true)
    }

    try {
      const nextReports = await loadReportsForMonth(month, year)
      if (isMountedRef.current) {
        setReports(nextReports)
      }
      return nextReports
    } catch (error) {
      console.error('Error cargando informes:', error)
      return []
    } finally {
      if (isMountedRef.current) {
        setLoading(false)
      }
    }
  }, [])

  React.useEffect(() => {
    const cached = getCachedReportsForMonth(selectedMonth, selectedYear)
    setReports(cached)
    setLoading(cached.length === 0)
    // Carga ÚNICA al montar o al cambiar de mes/año (cache-first).
    // Se elimina el polling por intervalo y el refetch en 'visibilitychange'
    // para minimizar el egress del pooler de Supabase: cada disparo ejecutaba
    // GET /reports (una consulta al pooler) mientras hubiera pestañas abiertas.
    void loadReports(selectedMonth, selectedYear, false)
  }, [loadReports, selectedMonth, selectedYear])

  // Realtime: el informe que se crea aparece EN VIVO en la lista (y los cambios
  // de estado / eliminaciones también se reflejan), sin polling. El evento llega
  // por Supabase Realtime —barato— en lugar de consultar el pooler.
  const handleRealtimeReport = React.useCallback((event: RealtimeEvent<any>) => {
    if (event.type === 'INSERT' || event.type === 'UPDATE') {
      const incoming = normalizeReportRecord(event.record as Record<string, unknown>)
      cacheReports([incoming])
      if (incoming.month !== selectedMonth || incoming.year !== selectedYear) {
        return
      }
      setReports(prev => {
        const next = [incoming, ...prev.filter(r => r.id !== incoming.id)]
        return next.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      })
    } else if (event.type === 'DELETE') {
      const removedId = String((event.oldRecord ?? event.record)?.id ?? '')
      if (removedId) {
        setReports(prev => prev.filter(r => r.id !== removedId))
      }
    }
  }, [selectedMonth, selectedYear])

  useRealtimeReports(handleRealtimeReport)

  const filtered = reports.filter(r => {
    const q = search.toLowerCase()
    return (
      r.insured_name.toLowerCase().includes(q) ||
      r.plate.toLowerCase().includes(q) ||
      r.policy.toLowerCase().includes(q) ||
      r.service_type.toLowerCase().includes(q) ||
      r.brand.toLowerCase().includes(q)
    )
  })

  const formatDateTimeWithMeridiem = (timestamp: string) => {
    const date = new Date(timestamp)
    const datePart = date.toLocaleDateString('es', {
      day: '2-digit', month: 'short', year: 'numeric',
    })
    const timePart = date.toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit', hour12: true,
    })
    return `${datePart} ${timePart}`
  }

  const getDaysInMonth = (month: string, year: number): number => {
    const monthIndex = MONTHS.indexOf(month)
    return new Date(year, monthIndex + 1, 0).getDate()
  }

  const filterReportsByDateRange = (reports: Report[], fromDay: number, toDay: number): Report[] => {
    return reports.filter(r => {
      const createdDate = new Date(r.created_at)
      const day = createdDate.getDate()
      const month = MONTHS[createdDate.getMonth()]
      const year = createdDate.getFullYear()
      return year === selectedYear && month === selectedMonth && day >= fromDay && day <= toDay
    })
  }

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

  const getReportMotivo = (report: Report) => {
    const text = `${report.observation_comment} ${report.service_type}`.toUpperCase()
    const found = MOTIVO_KEYWORDS.find(motivo => text.includes(motivo))
    return found ?? 'OTROS'
  }

  const sortReportsByMotivo = (a: Report, b: Report) => {
    const motivoA = getReportMotivo(a)
    const motivoB = getReportMotivo(b)
    const indexA = MOTIVO_ORDER.indexOf(motivoA)
    const indexB = MOTIVO_ORDER.indexOf(motivoB)

    if (indexA !== indexB) {
      return indexA - indexB
    }

    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  }

  const performExport = (dataToExport: Report[], fileName: string) => {
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
  }

  const handleExportFull = () => {
    performExport(filtered, `Informes_${selectedMonth}_${selectedYear}.xlsx`)
  }

  const handleExportRange = () => {
    const fromDay = parseInt(dayFrom) || 1
    const toDay = parseInt(dayTo) || getDaysInMonth(selectedMonth, selectedYear)
    
    if (fromDay < 1 || toDay < 1 || fromDay > toDay) {
      alert('Por favor ingresa un rango válido de días')
      return
    }
    
    const filtered_range = filterReportsByDateRange(reports, fromDay, toDay)
    performExport(filtered_range, `Informes_${selectedMonth}_${selectedYear}_${fromDay}-${toDay}.xlsx`)
  }

  const countByKeyword = (keyword: string): number => {
    return reports.filter(r => 
      r.observation_comment.toLowerCase().includes(keyword.toLowerCase()) ||
      r.service_type.toLowerCase().includes(keyword.toLowerCase())
    ).length
  }

  const countOtherReports = () => {
    return reports.filter(r => {
      const text = `${r.observation_comment} ${r.service_type}`.toUpperCase()
      return MOTIVO_KEYWORDS.every(keyword => !text.includes(keyword))
    }).length
  }

  const categories = [
    { label: 'SOAT', count: countByKeyword('SOAT'), chip: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 ring-sky-500/20', icon: Shield },
    { label: 'SALDO MOROSO', count: countByKeyword('SALDO MOROSO'), chip: 'bg-red-500/10 text-red-600 dark:text-red-400 ring-red-500/20', icon: AlertCircle },
    { label: 'RENOVACION NO PAGADA', count: countByKeyword('RENOVACION NO PAGADA'), chip: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 ring-orange-500/20', icon: Clock },
    { label: 'SERVICIO UTILIZADO', count: countByKeyword('SERVICIO UTILIZADO'), chip: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-emerald-500/20', icon: CheckCircle2 },
    { label: 'BENEFICIO EN 24H', count: countByKeyword('BENEFICIO EN 24H'), chip: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 ring-violet-500/20', icon: Zap },
    { label: 'POLIZA CANCELADA', count: countByKeyword('POLIZA CANCELADA'), chip: 'bg-muted text-muted-foreground ring-border', icon: XCircle },
    { label: 'NO CUBIERTO POR LA POLIZA', count: countByKeyword('NO CUBIERTO POR LA POLIZA'), chip: 'bg-muted text-muted-foreground ring-border', icon: XCircle },
    { label: 'OTROS', count: countOtherReports(), chip: 'bg-muted text-muted-foreground ring-border', icon: FileText },
  ]

  const handleDeleteReport = async (reportId: string) => {
    if (!canDeleteReports(user)) {
      if (isMountedRef.current) {
        setDeleteError('No tienes permisos para eliminar informes.')
      }
      return
    }

    // Check permission for soft-delete
    if (!hasPermission(PERMISSIONS.REPORTS.DELETE as PermissionKey)) {
      if (isMountedRef.current) {
        setDeleteError('No tienes permisos para eliminar informes.')
      }
      return
    }

    if (!isMountedRef.current) {
      return
    }

    setDeletingReportId(reportId)
    setDeleteError(null)

    try {
      // Use TrashService for soft-delete with audit logging
      await TrashService.moveToTrash(reportId, { id: reportId }, 'Manual deletion')
      
      if (isMountedRef.current) {
        setDeletingReportId(null)
      }
      await loadReports(selectedMonth, selectedYear)
    } catch (error) {
      if (isMountedRef.current) {
        setDeletingReportId(null)
        setDeleteError(error instanceof Error ? error.message : 'No se pudo eliminar el informe.')
      }
    }
  }

  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i)

  const ReportRowActions = ({ report }: { report: (typeof filtered)[number] }) => (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={e => { e.stopPropagation(); navigate(`/informes/${report.id}`) }}
        disabled={!canViewReports}
        title={!canViewReports ? 'No tienes permiso para ver informes' : 'Ver'}
      >
        <Eye className="size-4" />
      </Button>
      {canEditReportsPermission ? (
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={e => { e.stopPropagation(); navigate(`/informes/${report.id}/editar`) }}
          title="Editar informe"
        >
          <Pencil className="size-4" />
        </Button>
      ) : null}
      {canDeleteReportsPermission ? (
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-destructive hover:text-destructive"
          onClick={e => { e.stopPropagation(); void handleDeleteReport(report.id) }}
          disabled={deletingReportId === report.id}
          title="Eliminar informe"
        >
          {deletingReportId === report.id ? <Spinner className="size-4" /> : <Trash2 className="size-4" />}
        </Button>
      ) : null}
    </>
  )

  if (!canViewReports) {
    return (
      <div className="p-6 max-w-4xl mx-auto text-center">
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
    )
  }

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="mb-1.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            <span className="brand-gradient-bg size-1.5 rounded-full" aria-hidden="true" />
            Informes
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Informes</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {filtered.length} informe{filtered.length !== 1 ? 's' : ''} en {selectedMonth} {selectedYear}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canExportReports && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowExportModal(true)}
              disabled={filtered.length === 0}
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

      {/* Categories Palette */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {/* Total de Informes */}
        <Card className="relative overflow-hidden rounded-xl border bg-card shadow-sm">
          <span className="brand-gradient-bg absolute inset-x-0 top-0 h-0.5" aria-hidden="true" />
          <CardContent className="p-4">
            <div className="flex flex-col items-center gap-2 text-center">
              <span className="flex size-10 items-center justify-center rounded-xl ring-1 brand-monogram ring-transparent">
                <FileText className="size-5" />
              </span>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Total de Informes</p>
              <p className="text-3xl font-bold tabular-nums text-foreground">{filtered.length}</p>
            </div>
          </CardContent>
        </Card>

        {categories.map(cat => {
          const IconComponent = cat.icon
          return (
            <Card key={cat.label} className="rounded-xl border bg-card shadow-sm">
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
      <div className="flex flex-wrap gap-3">
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
          onValueChange={v => setSearchParams({ month: v, year: String(selectedYear) })}
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
          onValueChange={v => setSearchParams({ month: selectedMonth, year: v })}
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
      <Card className="rounded-xl border overflow-hidden">
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
          {loading ? (
            <div className="flex justify-center py-12">
              <Spinner className="size-6" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <span className="mb-4 flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground ring-1 ring-border">
                <FilePlus className="size-6" />
              </span>
              <p className="text-sm font-semibold text-foreground">No hay informes en {selectedMonth} {selectedYear}</p>
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
                    {filtered.map(report => (
                      <TableRow
                        key={report.id}
                        className={`border-border transition-colors hover:bg-accent ${canViewReports ? 'cursor-pointer' : 'cursor-not-allowed'}`}
                        onClick={() => canViewReports && navigate(`/informes/${report.id}`)}
                      >
                        <TableCell className="px-2 py-1.5 font-medium text-foreground truncate" title={report.insured_name}>{report.insured_name}</TableCell>
                        <TableCell className="px-2 py-1.5 font-mono tabular-nums text-foreground truncate" title={report.plate}>{report.plate}</TableCell>
                        <TableCell className="px-2 py-1.5">
                          <Badge variant="outline" className="max-w-full truncate text-xs" title={report.service_type}>{report.service_type}</Badge>
                        </TableCell>
                        <TableCell className="px-2 py-1.5 text-muted-foreground truncate" title={report.coverage && report.coverage.trim() ? report.coverage : 'No'}>{report.coverage && report.coverage.trim() ? report.coverage : 'No'}</TableCell>
                        <TableCell className="px-2 py-1.5 text-muted-foreground truncate" title={`${report.brand} ${report.model}`}>{report.brand} {report.model}</TableCell>
                        <TableCell className="px-2 py-1.5">
                          <Badge className={`max-w-full truncate text-xs font-medium ${STATUS_BADGE[report.status] ?? 'bg-secondary text-secondary-foreground ring-1 ring-inset ring-border'}`} title={report.status}>{report.status}</Badge>
                        </TableCell>
                        <TableCell className="px-2 py-1.5 text-muted-foreground truncate" title={report.created_by_name || report.created_by_email}>{report.created_by_name || report.created_by_email}</TableCell>
                        <TableCell className="px-2 py-1.5 text-xs text-muted-foreground tabular-nums truncate" title={formatDateTimeWithMeridiem(report.created_at)}>{formatDateTimeWithMeridiem(report.created_at)}</TableCell>
                        <TableCell className="px-2 py-1.5 text-right">
                          <div className="flex justify-end gap-0.5">
                            <ReportRowActions report={report} />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* MÓVIL (<768px): tarjetas apiladas */}
              <div className="block md:hidden divide-y divide-border">
                {filtered.map(report => (
                  <div
                    key={report.id}
                    role={canViewReports ? 'button' : undefined}
                    tabIndex={canViewReports ? 0 : undefined}
                    onClick={() => canViewReports && navigate(`/informes/${report.id}`)}
                    onKeyDown={e => { if (canViewReports && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); navigate(`/informes/${report.id}`) } }}
                    className={`p-4 space-y-3 transition-colors hover:bg-accent ${canViewReports ? 'cursor-pointer' : 'cursor-not-allowed'}`}
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
                      <ReportRowActions report={report} />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Export Modal */}
      <Dialog open={showExportModal} onOpenChange={setShowExportModal}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Opciones de Exportación</DialogTitle>
            <DialogDescription>
              Selecciona cómo deseas exportar los informes de {selectedMonth} {selectedYear}
            </DialogDescription>
          </DialogHeader>

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
                  Total de informes: {filtered.length}
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
              }}
            >
              Cancelar
            </Button>
            {exportMode === 'full' ? (
              <Button onClick={handleExportFull}>
                Exportar
              </Button>
            ) : exportMode === 'range' ? (
              <Button onClick={handleExportRange}>
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
