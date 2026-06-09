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
import { MONTHS, SERVICE_TYPES, type Report, loadReportsForMonth, deleteReport, getCachedReportsForMonth } from '@/lib/supabase'
import { useAuth, canDeleteReports } from '@/lib/auth'
import { FilePlus, Download, Search, Eye, Trash2, Shield, AlertCircle, Clock, CheckCircle2, Zap, XCircle, FileText } from 'lucide-react'
import * as XLSX from 'xlsx'

const STATUS_BADGE: Record<string, string> = {
  'Caso Finalizado': 'bg-emerald-500/15 text-emerald-700 border-emerald-200',
  'Seguimiento de caso': 'bg-amber-500/15 text-amber-700 border-amber-200',
  'Falta de Informacion': 'bg-destructive/15 text-destructive border-destructive/20',
  'Informativo': 'bg-emerald-500/15 text-emerald-700 border-emerald-200',
  'Validacion': 'bg-emerald-500/15 text-emerald-700 border-emerald-200',
  'Cotizacion': 'bg-blue-500/15 text-blue-700 border-blue-200',
}

function normalizeHeader(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

function normalizeString(value: unknown) {
  if (typeof value === 'string') {
    return value.trim()
  }

  if (value === null || value === undefined) {
    return ''
  }

  return String(value).trim()
}

function toNullableInt(value: unknown) {
  if (value === null || value === undefined) {
    return null
  }

  const trimmed = normalizeString(value)
  if (!trimmed) {
    return null
  }

  const numeric = Number(trimmed)
  return Number.isFinite(numeric) ? numeric : null
}

function resolveMonth(value: unknown, fallback: string) {
  const normalized = normalizeString(value)
  if (!normalized) {
    return fallback
  }

  const match = MONTHS.find(month => normalizeHeader(month) === normalizeHeader(normalized))
  return match ?? fallback
}

function resolveStatus(value: unknown, fallback = 'Seguimiento de caso') {
  const normalized = normalizeString(value)
  if (!normalized) {
    return fallback
  }

  if (
    normalized === 'Caso Finalizado' ||
    normalized === 'Seguimiento de caso' ||
    normalized === 'Falta de Informacion' ||
    normalized === 'Informativo' ||
    normalized === 'Validacion' ||
    normalized === 'Cotizacion'
  ) {
    return normalized
  }

  return fallback
}

function getLookupValue(lookup: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = lookup[key]
    if (value !== undefined && value !== null && normalizeString(value) !== '') {
      return normalizeString(value)
    }
  }

  return ''
}

function resolveServiceType(value: unknown) {
  const normalized = normalizeString(value)
  if (!normalized) {
    return ''
  }

  return SERVICE_TYPES.find(service => normalizeHeader(service) === normalizeHeader(normalized)) ?? ''
}

export default function ReportsList() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user } = useAuth()

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

  const loadReports = React.useCallback(async (month: string, year: number, showSpinner = true) => {
    if (showSpinner) {
      setLoading(true)
    }

    try {
      const nextReports = await loadReportsForMonth(month, year)
      setReports(nextReports)
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    const cached = getCachedReportsForMonth(selectedMonth, selectedYear)
    setReports(cached)
    setLoading(cached.length === 0)
    void loadReports(selectedMonth, selectedYear, false)

    const intervalId = window.setInterval(() => {
      void loadReports(selectedMonth, selectedYear, false)
    }, 10000)

    return () => window.clearInterval(intervalId)
  }, [loadReports, selectedMonth, selectedYear])

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
  ]

  const getReportMotivo = (report: Report) => {
    const text = `${report.observation_comment} ${report.service_type}`.toUpperCase()
    const found = MOTIVO_ORDER.find(motivo => text.includes(motivo))
    return found ?? ''
  }

  const sortReportsByMotivo = (a: Report, b: Report) => {
    const motivoA = getReportMotivo(a)
    const motivoB = getReportMotivo(b)
    const indexA = motivoA ? MOTIVO_ORDER.indexOf(motivoA) : MOTIVO_ORDER.length
    const indexB = motivoB ? MOTIVO_ORDER.indexOf(motivoB) : MOTIVO_ORDER.length

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

  const categories = [
    { label: 'SOAT', count: countByKeyword('SOAT'), color: 'bg-blue-500/10 text-blue-700 border-blue-200', icon: Shield, iconColor: 'text-blue-600' },
    { label: 'SALDO MOROSO', count: countByKeyword('SALDO MOROSO'), color: 'bg-red-500/10 text-red-700 border-red-200', icon: AlertCircle, iconColor: 'text-red-600' },
    { label: 'RENOVACION NO PAGADA', count: countByKeyword('RENOVACION NO PAGADA'), color: 'bg-orange-500/10 text-orange-700 border-orange-200', icon: Clock, iconColor: 'text-orange-600' },
    { label: 'SERVICIO UTILIZADO', count: countByKeyword('SERVICIO UTILIZADO'), color: 'bg-green-500/10 text-green-700 border-green-200', icon: CheckCircle2, iconColor: 'text-green-600' },
    { label: 'BENEFICIO EN 24H', count: countByKeyword('BENEFICIO EN 24H'), color: 'bg-purple-500/10 text-purple-700 border-purple-200', icon: Zap, iconColor: 'text-purple-600' },
    { label: 'POLIZA CANCELADA', count: countByKeyword('POLIZA CANCELADA'), color: 'bg-gray-500/10 text-gray-700 border-gray-200', icon: XCircle, iconColor: 'text-gray-600' },
    { label: 'NO CUBIERTO POR LA POLIZA', count: countByKeyword('NO CUBIERTO POR LA POLIZA'), color: 'bg-slate-500/10 text-slate-700 border-slate-200', icon: XCircle, iconColor: 'text-slate-600' },
  ]

  const handleDeleteReport = async (reportId: string) => {
    if (!canDeleteReports(user)) {
      setDeleteError('No tienes permisos para eliminar informes.')
      return
    }

    setDeletingReportId(reportId)
    setDeleteError(null)

    try {
      await deleteReport(reportId)
      setDeletingReportId(null)
      await loadReports(selectedMonth, selectedYear)
    } catch (error) {
      setDeletingReportId(null)
      setDeleteError(error instanceof Error ? error.message : 'No se pudo eliminar el informe.')
    }
  }

  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i)

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Informes</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {filtered.length} informe{filtered.length !== 1 ? 's' : ''} en {selectedMonth} {selectedYear}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
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
              <Button
            size="sm"
            onClick={() => navigate('/informes/nuevo')}
            className="gap-2 bg-destructive hover:bg-destructive/90 text-white"
          >
            <FilePlus className="size-4" />
            Nuevo Informe
          </Button>
        </div>
      </div>

      {/* Categories Palette */}
      <div className="grid grid-cols-4 gap-3">
        {/* Total de Informes */}
        <Card className="dashboard-soft-surface border border-border/70 bg-gradient-to-br from-primary/5 to-primary/10">
          <CardContent className="p-4">
            <div className="flex flex-col items-center text-center">
              <FileText className="size-5 mb-2 text-primary" />
              <p className="text-xs uppercase tracking-wide font-medium mb-2 text-muted-foreground">Total de Informes</p>
              <p className="text-2xl font-bold text-foreground">{filtered.length}</p>
            </div>
          </CardContent>
        </Card>

        {categories.map(cat => {
          const IconComponent = cat.icon
          return (
            <Card key={cat.label} className="dashboard-soft-surface border border-border/70">
              <CardContent className="p-4">
                <div className="flex flex-col items-center text-center">
                  <IconComponent className={`size-5 mb-2 ${cat.iconColor}`} />
                  <p className="text-xs uppercase tracking-wide font-medium mb-2 text-muted-foreground">{cat.label}</p>
                  <p className="text-2xl font-bold text-foreground">{cat.count}</p>
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
      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            {selectedMonth} {selectedYear}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {deleteError ? (
            <div className="px-4 pt-4">
              <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">{deleteError}</p>
            </div>
          ) : null}
          {loading ? (
            <div className="flex justify-center py-12">
              <Spinner className="size-6" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <FilePlus className="size-12 text-muted-foreground/30 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">No hay informes en {selectedMonth} {selectedYear}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => navigate('/informes/nuevo')}
              >
                Crear informe
              </Button>
            </div>
          ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="text-xs uppercase tracking-wide">Asegurado</TableHead>
                    <TableHead className="text-xs uppercase tracking-wide">Placa</TableHead>
                    <TableHead className="text-xs uppercase tracking-wide">Servicio</TableHead>
                    <TableHead className="text-xs uppercase tracking-wide">Cobertura</TableHead>
                    <TableHead className="text-xs uppercase tracking-wide">Vehículo</TableHead>
                    <TableHead className="text-xs uppercase tracking-wide">Estado</TableHead>
                    <TableHead className="text-xs uppercase tracking-wide">Creado por</TableHead>
                    <TableHead className="text-xs uppercase tracking-wide">Fecha</TableHead>
                    <TableHead className="text-xs uppercase tracking-wide text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(report => (
                    <TableRow
                      key={report.id}
                      className="hover:bg-accent/40 cursor-pointer"
                      onClick={() => navigate(`/informes/${report.id}`)}
                    >
                      <TableCell className="font-medium text-sm">{report.insured_name}</TableCell>
                      <TableCell className="text-sm font-mono">{report.plate}</TableCell>
                      <TableCell className="text-sm">
                        <Badge variant="outline" className="text-xs whitespace-nowrap">
                          {report.service_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {report.coverage && report.coverage.trim() ? report.coverage : 'No'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {report.brand} {report.model}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={`text-xs border ${STATUS_BADGE[report.status] ?? 'bg-secondary text-secondary-foreground'}`}
                        >
                          {report.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {report.created_by_name || report.created_by_email}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDateTimeWithMeridiem(report.created_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={e => { e.stopPropagation(); navigate(`/informes/${report.id}`) }}
                          >
                            <Eye className="size-4" />
                          </Button>
                          {canDeleteReports(user) ? (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="text-destructive hover:text-destructive"
                              onClick={e => {
                                e.stopPropagation()
                                void handleDeleteReport(report.id)
                              }}
                              disabled={deletingReportId === report.id}
                              title="Eliminar informe"
                            >
                              {deletingReportId === report.id ? (
                                <Spinner className="size-4" />
                              ) : (
                                <Trash2 className="size-4" />
                              )}
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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
