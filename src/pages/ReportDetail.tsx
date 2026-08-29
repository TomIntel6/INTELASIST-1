import * as React from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { REPORT_STATUSES, type Report, type ReportStatus, type ReportUpdate, loadReportWithUpdates, addReportUpdate } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { usePermissions } from '@/lib/permissions-context'
import type { PermissionKey } from '@/lib/permissions'
import { AuditService } from '@/lib/audit-service'
import { PERMISSIONS } from '@/lib/permissions'
import { cn } from '@/lib/utils'
import { ArrowLeft, Send, User, Calendar, Car, FileText, Wrench, Image as ImageIcon, ZoomIn, Copy, History, Pencil } from 'lucide-react'

const STATUS_BADGE: Record<string, string> = {
  'Caso Finalizado': 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  'Seguimiento de caso': 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  'Falta de Informacion': 'bg-destructive/10 text-destructive border-destructive/20',
  'Informativo': 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  'Validacion': 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20',
  'Cotizacion': 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20',
}

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?'
}

function formatDateTimeWithMeridiem(dateString: string) {
  const date = new Date(dateString)
  const datePart = date.toLocaleDateString('es', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
  const timePart = date.toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', hour12: true,
  })
  return `${datePart} ${timePart}`
}

function parseObservationComment(comment: string) {
  const trimmed = comment.trim()
  const prefix = 'Motivo:'
  if (trimmed.startsWith(prefix)) {
    const [firstLine, ...rest] = trimmed.split(/\r?\n/)
    const reason = firstLine.slice(prefix.length).trim()
    const text = rest.join('\n').trim()
    return {
      reason: reason || null,
      text,
    }
  }

  return {
    reason: null,
    text: trimmed,
  }
}

function isReportStatusLocked(status: ReportStatus | null | undefined) {
  return status === 'Informativo' || status === 'Validacion'
}

function getAvailableReportUpdateStatuses(report: Report | null) {
  if (!report) {
    return REPORT_STATUSES
  }

  if (isReportStatusLocked(report.status)) {
    return [report.status]
  }

  if (report.status === 'Seguimiento de caso') {
    return REPORT_STATUSES.filter((status) => status === 'Seguimiento de caso' || status === 'Caso Finalizado')
  }

  return REPORT_STATUSES.filter((status) => {
    if (status === 'Cotizacion' || status === 'Falta de Informacion') {
      return false
    }

    if (status === 'Caso Finalizado' && report?.status !== 'Seguimiento de caso') {
      return false
    }

    return true
  })
}

function TimeAgo({ date }: { date: string }) {
  const d = new Date(date)
  const title = d.toLocaleString('es', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  })

  return (
    <span title={title}>
      {formatDateTimeWithMeridiem(date)}
    </span>
  )
}

export default function ReportDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { hasPermission } = usePermissions()
  const canViewReports = hasPermission(PERMISSIONS.REPORTS.VIEW as PermissionKey) || hasPermission(PERMISSIONS.REPORTS.VIEW_ALL as PermissionKey)
  const canAddUpdates = hasPermission(PERMISSIONS.UPDATES.ADD as PermissionKey)
  const canChangeReportStatus = hasPermission(PERMISSIONS.REPORTS.CHANGE_STATUS as PermissionKey)
  // La edición de informes ya creados requiere el permiso de gestión de permisos.
  const canEditReports = hasPermission(PERMISSIONS.SYSTEM.MANAGE_PERMISSIONS as PermissionKey)

  const [report, setReport] = React.useState<Report | null>(null)
  const [updates, setUpdates] = React.useState<ReportUpdate[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [auditEvents, setAuditEvents] = React.useState<any[]>([])
  const [showAuditPanel, setShowAuditPanel] = React.useState(false)

  const [newStatus, setNewStatus] = React.useState<ReportStatus>('Seguimiento de caso')
  const [newComment, setNewComment] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)

  const handleNewStatusChange = (value: string) => {
    setNewStatus(value as ReportStatus)
  }
  const [submitError, setSubmitError] = React.useState<string | null>(null)
  const [showImageModal, setShowImageModal] = React.useState(false)
  const [modalImageUrl, setModalImageUrl] = React.useState<string | null>(null)
  const [copySuccess, setCopySuccess] = React.useState<string | null>(null)

  const fetchData = React.useCallback(async () => {
    if (!id) return

    try {
      const currentReport = await loadReportWithUpdates(id)
      
      if (!currentReport) {
        setError('No se pudo cargar el informe. Por favor intenta más tarde o verifica que exista.')
        setReport(null)
        setUpdates([])
      } else {
        setReport(currentReport)
        setUpdates(currentReport.report_updates ?? [])
        const allowedStatuses = getAvailableReportUpdateStatuses(currentReport)
        setNewStatus((previousStatus) => {
          if (allowedStatuses.includes(previousStatus)) {
            return previousStatus
          }

          if (allowedStatuses.includes(currentReport.status)) {
            return currentReport.status
          }

          return allowedStatuses[0] ?? 'Seguimiento de caso'
        })
        setError(null)
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error al cargar el informe.'
      console.error('Error en fetchData:', errorMsg, err)
      setError(errorMsg)
      setReport(null)
      setUpdates([])
    } finally {
      setLoading(false)
    }
  }, [id])

  React.useEffect(() => {
    void fetchData()
  }, [id, fetchData])

  // Sin polling ni refetch por 'visibilitychange' del detalle: se carga una vez
  // al abrir el informe y se refresca tras añadir una actualización (handleAddUpdate).
  // Esto elimina consultas repetidas a GET /reports/:id contra el pooler de Supabase.

  React.useEffect(() => {
    if (!report || !showAuditPanel) {
      return
    }

    let isMounted = true

    const loadAuditEvents = async () => {
      try {
        const { data } = await AuditService.fetchAuditLogs({
          entityId: id,
          module: 'REPORTS',
          limit: 50,
          offset: 0,
        })

        if (isMounted) {
          setAuditEvents(data)
        }
      } catch (err) {
        console.error('Error loading audit events:', err)
      }
    }

    void loadAuditEvents()

    return () => {
      isMounted = false
    }
  }, [report, id, showAuditPanel])

  const handleAddUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newComment.trim()) { setSubmitError('Escribe un comentario.'); return }
    
    // Check permission
    if (!canAddUpdates) {
      setSubmitError('No tienes permisos para agregar actualizaciones.')
      return
    }

    if (newStatus !== report?.status && !canChangeReportStatus) {
      setSubmitError('No tienes permisos para cambiar el estado del informe.')
      return
    }

    setSubmitting(true)
    setSubmitError(null)

    const displayName = user?.user_metadata?.full_name ?? user?.email ?? ''
    const isLocked = isReportStatusLocked(report?.status)
    const statusToSend = isLocked ? report!.status : newStatus

    try {
      await addReportUpdate(id!, {
        status: statusToSend,
        comment: newComment,
        added_by: user?.id ?? null,
        added_by_name: displayName,
        added_by_email: user?.email ?? '',
      })

      // Log audit event
      if (statusToSend !== report?.status) {
        await AuditService.logStatusChanged(
          id!,
          report?.status || 'unknown',
          statusToSend
        )
      }
      
      await AuditService.logUpdateAdded(id!, id!, { comment: newComment })

      setNewComment('')
      await fetchData()

      if (showAuditPanel) {
        const { data: events } = await AuditService.fetchAuditLogs({
          entityId: id,
          module: 'REPORTS',
          limit: 50,
          offset: 0,
        })
        setAuditEvents(events)
      }
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'No se pudo agregar la actualización.')
    }

    setSubmitting(false)
  }

  const copyObservationToClipboard = async (text: string) => {
    if (!text) {
      return
    }

    try {
      await navigator.clipboard.writeText(text)
      setCopySuccess('Información copiada al portapapeles')
      window.setTimeout(() => setCopySuccess(null), 2000)
    } catch (err) {
      console.error('Error copiando observación:', err)
      setCopySuccess('No se pudo copiar. Intenta nuevamente.')
      window.setTimeout(() => setCopySuccess(null), 2000)
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="text-center space-y-3">
          <Spinner className="size-6 mx-auto" />
          <p className="text-sm text-muted-foreground">Cargando informe...</p>
        </div>
      </div>
    )
  }

  if (error || !report) {
    return (
      <div className="p-8 text-center space-y-4">
        <div className="space-y-2">
          <p className="text-sm font-medium text-destructive">{error || 'Informe no encontrado.'}</p>
          <p className="text-xs text-muted-foreground">{error ? 'Verifica tu conexión e intenta de nuevo.' : 'El informe solicitado no existe.'}</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          {error && (
            <Button variant="outline" size="sm" onClick={() => {
              setLoading(true)
              setError(null)
              void fetchData()
            }}>
              Reintentar
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => navigate('/informes')}>
            Volver a informes
          </Button>
        </div>
      </div>
    )
  }

  const observation = parseObservationComment(report.observation_comment || '')
  const observationCopyText = observation.text || ''
  const evidenceImages = report.evidence_urls && report.evidence_urls.length > 0
    ? report.evidence_urls
    : report.evidence_url
      ? [{ url: report.evidence_url, filename: report.evidence_filename ?? '', path: report.evidence_path ?? '' }]
      : []

  if (!canViewReports) {
    return (
      <div className="mx-auto max-w-4xl p-6 text-center">
        <div className="glass-panel relative overflow-hidden rounded-[1.5rem] p-8">
          <span className="brand-gradient-bg pointer-events-none absolute inset-x-0 top-0 h-1 opacity-80" aria-hidden="true" />
          <p className="text-lg font-semibold text-destructive">No tienes permisos para ver este informe.</p>
          <p className="mt-2 text-sm text-muted-foreground">Solicita acceso a un administrador para ver reportes.</p>
          <div className="mt-4 flex justify-center">
            <Button variant="outline" onClick={() => navigate(-1)}>
              Volver
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full space-y-5 p-4 sm:p-6 xl:p-8">
      <div className="glass-panel relative overflow-hidden rounded-[1.5rem] p-5 sm:p-6">
        <span className="brand-gradient-bg pointer-events-none absolute inset-x-0 top-0 h-1 opacity-80" aria-hidden="true" />

        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <Button variant="ghost" size="icon-sm" onClick={() => navigate(-1)} className="mt-0.5 shrink-0">
              <ArrowLeft className="size-4" />
            </Button>

            <div className="min-w-0 flex-1">
              <p className="mb-1.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                <span className="brand-gradient-bg size-1.5 rounded-full" aria-hidden="true" />
                Detalle de informe
              </p>

              <div className="flex flex-wrap items-center gap-3">
                <h1 className="truncate text-2xl font-black tracking-[-0.04em] text-foreground">{report.insured_name}</h1>
                {report.status ? (
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${STATUS_BADGE[report.status] ?? 'bg-secondary text-secondary-foreground border-border'}`}>
                    {report.status}
                  </span>
                ) : null}
              </div>

              <p className="mt-1 text-sm text-muted-foreground">
                {report.month} {report.year} • Placa: {report.plate}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {canEditReports ? (
              <Button variant="outline" size="sm" onClick={() => navigate(`/informes/${id}/editar`)} className="gap-2">
                <Pencil className="size-4" />
                Editar
              </Button>
            ) : null}
            <Button variant="outline" size="sm" onClick={() => setShowAuditPanel(v => !v)} className="gap-2">
              <History className="size-4" />
              Historial
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.7fr_1fr]">
        <div className="space-y-4">
          <Card className="rounded-[1.5rem] border border-slate-200 bg-slate-50/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-xl font-black tracking-tight">Información del Asegurado</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-x-6 gap-y-4 sm:grid-cols-2 text-sm">
              <div className="space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Nombre</p>
                <p className="text-base font-black tracking-tight text-foreground">{report.insured_name}</p>
              </div>

              <div className="space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Placa</p>
                <p className="text-base font-black tracking-tight text-foreground">{report.plate}</p>
              </div>

              <div className="space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Póliza</p>
                <p className="text-base font-medium text-foreground">{report.policy || '—'}</p>
              </div>

              <div className="space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Servicio</p>
                <div className="inline-flex items-center rounded-full border border-slate-300 bg-slate-100/80 px-2.5 py-1 text-xs font-medium text-foreground">
                  {report.service_type}
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Estado</p>
                <p className="text-base font-medium text-foreground">{report.status}</p>
              </div>

              <div className="space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Mes</p>
                <p className="text-base font-medium text-foreground">{report.month} {report.year}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[1.5rem] border border-violet-200 bg-violet-50/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-xl font-black tracking-tight">Datos del Vehículo</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-x-6 gap-y-4 sm:grid-cols-2 text-sm">
              <div className="space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Marca</p>
                <p className="text-base font-black tracking-tight text-foreground">{report.brand || '—'}</p>
              </div>

              <div className="space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Modelo</p>
                <p className="text-base font-black tracking-tight text-foreground">{report.model || '—'}</p>
              </div>

              <div className="space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Color</p>
                <p className="text-base font-medium text-foreground">{report.color || '—'}</p>
              </div>

              <div className="space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Año</p>
                <p className="text-base font-medium text-foreground">{report.year_vehicle || '—'}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[1.5rem] border border-amber-200 bg-amber-50/30">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-xl font-black tracking-tight">Observación Inicial</CardTitle>
                <Button variant="ghost" size="icon-sm" onClick={() => copyObservationToClipboard(observationCopyText)} disabled={!observationCopyText} title="Copiar observación">
                  <Copy className="size-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {observation.reason ? (
                <div className="inline-flex items-center rounded-full bg-slate-200/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-700">
                  Motivo: {observation.reason}
                </div>
              ) : null}

              <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">
                {observation.text || 'Sin observación adicional.'}
              </p>

              {copySuccess ? (
                <p className="text-xs text-emerald-600">{copySuccess}</p>
              ) : null}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="rounded-[1.5rem] border border-slate-200 bg-slate-50/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-xl font-black tracking-tight">Detalles</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="space-y-1 border-b border-slate-200 pb-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Periodo</p>
                <p className="text-base font-medium text-foreground">{report.month} {report.year}</p>
              </div>

              <div className="space-y-1 border-b border-slate-200 pb-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Creado por</p>
                <p className="text-base font-medium text-foreground">{report.created_by_name || report.created_by_email || '—'}</p>
                {report.created_by_email ? (
                  <p className="text-xs text-muted-foreground">{report.created_by_email}</p>
                ) : null}
              </div>

              <div className="space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Fecha</p>
                <p className="text-base font-medium text-foreground">{formatDateTimeWithMeridiem(report.created_at)}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[1.5rem] border border-slate-200 bg-slate-50/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-xl font-black tracking-tight">Agregar Actualización</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Estado</Label>
                <Select value={newStatus} onValueChange={handleNewStatusChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecciona un estado" />
                  </SelectTrigger>
                  <SelectContent>
                    {getAvailableReportUpdateStatuses(report).map(status => (
                      <SelectItem key={status} value={status}>{status}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="newComment" className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Comentario</Label>
                <Textarea
                  id="newComment"
                  value={newComment}
                  onChange={e => setNewComment(e.target.value)}
                  placeholder="Describe la actualización del caso..."
                  className="min-h-[120px] resize-none"
                />
              </div>

              {submitError ? (
                <p className="text-sm text-destructive">{submitError}</p>
              ) : null}

              <Button onClick={handleAddUpdate as any} disabled={submitting || !newComment.trim()} className="w-full gap-2">
                <Send className="size-4" />
                {submitting ? 'Guardando...' : 'Guardar actualización'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {evidenceImages.length > 0 ? (
        <Card className="rounded-[1.5rem] border border-emerald-200 bg-emerald-50/30">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 ring-1 ring-emerald-500/20" aria-hidden="true">
                  <ImageIcon className="size-5" />
                </span>
                <CardTitle className="text-xl font-black tracking-tight">Evidencia subida</CardTitle>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {evidenceImages.map((image, index) => (
                <div key={`${image.url}-${index}`} className="group relative overflow-hidden rounded-xl border border-emerald-200 bg-white shadow-sm">
                  <img
                    src={image.url}
                    alt={image.filename || `Evidencia ${index + 1}`}
                    className="h-40 w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setModalImageUrl(image.url)
                      setShowImageModal(true)
                    }}
                    className="absolute inset-0 flex items-center justify-center bg-slate-950/20 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                    aria-label={`Ver evidencia ${index + 1}`}
                  >
                    <span className="flex items-center gap-2 rounded-full bg-white/90 px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm">
                      <ZoomIn className="size-4" />
                      Ver imagen
                    </span>
                  </button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {showAuditPanel ? (
        <Card className="rounded-[1.5rem] border border-slate-200">
          <CardHeader>
            <CardTitle className="text-xl font-black tracking-tight">Historial</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {auditEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay historial para este informe.</p>
            ) : (
              auditEvents.map((event, index) => (
                <div key={`${event.id ?? index}`} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium text-foreground">{event.action ?? 'Evento'}</span>
                    <span className="text-xs text-muted-foreground">{event.created_at ? TimeAgo({ date: event.created_at }) : '—'}</span>
                  </div>
                  {event.details ? (
                    <p className="mt-2 whitespace-pre-line text-xs text-muted-foreground">{event.details}</p>
                  ) : null}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      ) : null}

      <Dialog open={showImageModal} onOpenChange={open => {
        setShowImageModal(open)
        if (!open) {
          setModalImageUrl(null)
        }
      }}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden">
          {modalImageUrl ? (
            <img src={modalImageUrl} alt="Evidencia ampliada" className="max-h-[80vh] w-full object-contain" />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-0.5">{label}</p>
      <div className="text-sm font-medium text-foreground">{value || '—'}</div>
    </div>
  )
}
