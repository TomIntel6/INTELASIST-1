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
import { REPORT_STATUSES, type Report, type ReportStatus, type ReportUpdate, loadReportWithUpdates, addReportUpdate, getCachedReportById } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { usePermissions } from '@/lib/permissions-context'
import type { PermissionKey } from '@/lib/permissions'
import { AuditService } from '@/lib/audit-service'
import { PERMISSIONS } from '@/lib/permissions'
import { ArrowLeft, Send, User, Calendar, Car, FileText, Wrench, Image as ImageIcon, ZoomIn, Copy, History } from 'lucide-react'

const STATUS_BADGE: Record<string, string> = {
  'Caso Finalizado': 'bg-emerald-500/15 text-emerald-700 border-emerald-200',
  'Seguimiento de caso': 'bg-amber-500/15 text-amber-700 border-amber-200',
  'Falta de Informacion': 'bg-destructive/15 text-destructive border-destructive/20',
  'Informativo': 'bg-emerald-500/15 text-emerald-700 border-emerald-200',
  'Validacion': 'bg-emerald-500/15 text-emerald-700 border-emerald-200',
  'Cotizacion': 'bg-blue-500/15 text-blue-700 border-blue-200',
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

  const cachedReport = id ? getCachedReportById(id) : null
  const [report, setReport] = React.useState<Report | null>(cachedReport)
  const [updates, setUpdates] = React.useState<ReportUpdate[]>(cachedReport?.report_updates ?? [])
  const [loading, setLoading] = React.useState(cachedReport === null)
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

  React.useEffect(() => {
    if (!report) return

    const intervalId = window.setInterval(() => {
      void fetchData()
    }, 15000)

    // Load audit events for this report
    const loadAuditEvents = async () => {
      try {
        const events = await AuditService.fetchAuditLogs({
          entityId: id,
          module: 'REPORTS',
        })
        if (Array.isArray(events)) {
          setAuditEvents(events)
        }
      } catch (err) {
        console.error('Error loading audit events:', err)
      }
    }

    void loadAuditEvents()

    return () => window.clearInterval(intervalId)
  }, [report, fetchData, id])

  const handleAddUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newComment.trim()) { setSubmitError('Escribe un comentario.'); return }
    
    // Check permission
    if (!hasPermission(PERMISSIONS.UPDATES.ADD as PermissionKey)) {
      setSubmitError('No tienes permisos para agregar actualizaciones.')
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
      
      // Reload audit events
      const events = await AuditService.fetchAuditLogs({
        entityId: id,
        module: 'REPORTS',
      })
      if (Array.isArray(events)) {
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

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-start gap-3 justify-between">
        <div className="flex items-start gap-3 flex-1">
          <Button variant="ghost" size="icon-sm" onClick={() => navigate(-1)} className="mt-0.5">
            <ArrowLeft className="size-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-xl font-bold text-foreground truncate">{report.insured_name}</h1>
              <Badge
                className={`text-xs border ${STATUS_BADGE[report.status] ?? 'bg-secondary'}`}
              >
                {report.status}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              {report.month} {report.year} &bull; Placa: <span className="font-mono font-medium text-foreground">{report.plate}</span>
            </p>
          </div>
        </div>
        {hasPermission(PERMISSIONS.SYSTEM.VIEW_AUDIT_LOGS as PermissionKey) && (
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setShowAuditPanel(!showAuditPanel)}
            className="gap-2"
          >
            <History className="size-4" />
            Historial
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Report info */}
        <div className="lg:col-span-2 space-y-4">
          {/* Asegurado + Servicio */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <User className="size-4 text-muted-foreground" />
                Información del Asegurado
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <InfoRow label="Nombre" value={report.insured_name} />
              <InfoRow label="Placa" value={<span className="font-mono">{report.plate}</span>} />
              <InfoRow label="Póliza" value={report.policy} />
              <InfoRow label="Servicio" value={
                <Badge variant="outline" className="text-xs">{report.service_type}</Badge>
              } />
            </CardContent>
          </Card>

          {/* Vehículo */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Car className="size-4 text-muted-foreground" />
                Datos del Vehículo
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <InfoRow label="Marca" value={report.brand} />
              <InfoRow label="Modelo" value={report.model} />
              <InfoRow label="Color" value={report.color} />
              <InfoRow label="Año" value={report.year_vehicle ? String(report.year_vehicle) : '—'} />
            </CardContent>
          </Card>

          {/* Observación inicial */}
          {(report.observation_comment || report.observation_comment === '') && (
            <Card>
              <CardHeader className="pb-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Wrench className="size-4 text-muted-foreground" />
                  Observación Inicial
                </CardTitle>
                {observationCopyText ? (
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-2"
                      onClick={() => void copyObservationToClipboard(observationCopyText)}
                    >
                      <Copy className="size-4" />
                    </Button>
                    {copySuccess ? (
                      <span className="text-xs text-emerald-600">{copySuccess}</span>
                    ) : null}
                  </div>
                ) : null}
              </CardHeader>
              <CardContent className="space-y-3">
                {(() => {
                  const observation = parseObservationComment(report.observation_comment || '')
                  return (
                    <>
                      {observation.reason ? (
                        <div className="inline-flex flex-wrap items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                          <span>Motivo:</span>
                          <span className="rounded-full bg-primary/20 px-2 py-1 font-semibold text-primary">{observation.reason}</span>
                        </div>
                      ) : null}
                      {observation.text ? (
                        <p className="whitespace-pre-line text-sm text-foreground leading-relaxed">
                          {observation.text}
                        </p>
                      ) : (
                        <p className="text-sm text-muted-foreground">No hay observación adicional.</p>
                      )}
                    </>
                  )
                })()}
              </CardContent>
            </Card>
          )}

          {/* Evidencia */}
          {evidenceImages.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <ImageIcon className="size-4 text-muted-foreground" />
                  Evidencia
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {evidenceImages.map((image, index) => (
                    <img
                      key={`${image.url}-${index}`}
                      src={image.url}
                      alt={`Evidencia ${index + 1}`}
                      className="w-full rounded-lg border border-border/70 object-cover max-h-80 cursor-pointer hover:opacity-90 transition-opacity"
                      onClick={() => {
                        setModalImageUrl(image.url)
                        setShowImageModal(true)
                      }}
                    />
                  ))}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => {
                    setModalImageUrl(evidenceImages[0]?.url ?? null)
                    setShowImageModal(true)
                  }}
                >
                  <ZoomIn className="size-4" />
                  Ampliar imagen
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Timeline de updates */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="size-4 text-muted-foreground" />
                Historial de Actualizaciones
                {updates.length > 0 && (
                  <Badge variant="secondary" className="text-xs ml-1">{updates.length}</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Creation entry */}
              <div className="flex gap-3">
                <Avatar size="sm" className="shrink-0 mt-0.5">
                  <AvatarFallback className="text-xs">{getInitials(report.created_by_name || report.created_by_email)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="text-sm font-medium">{report.created_by_name || report.created_by_email}</span>
                    <span className="text-xs text-muted-foreground">creó este informe</span>
                    <Badge className={`text-xs border ${STATUS_BADGE[report.status] ?? ''}`}>
                      {report.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    <Calendar className="size-3 inline mr-1" />
                    <TimeAgo date={report.created_at} />
                  </p>
                </div>
              </div>

              {updates.map((u) => (
                <React.Fragment key={u.id}>
                  <Separator />
                  <div className="flex gap-3">
                    <Avatar size="sm" className="shrink-0 mt-0.5">
                      <AvatarFallback className="text-xs">{getInitials(u.added_by_name || u.added_by_email)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="text-sm font-medium">{u.added_by_name || u.added_by_email}</span>
                        <span className="text-xs text-muted-foreground">actualizó</span>
                        <Badge className={`text-xs border ${STATUS_BADGE[u.status] ?? ''}`}>
                          {u.status}
                        </Badge>
                      </div>
                      {u.comment && (
                        <p className="text-sm text-foreground bg-muted/50 rounded-md px-3 py-2 mb-1 leading-relaxed">
                          {u.comment}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        <Calendar className="size-3 inline mr-1" />
                        <TimeAgo date={u.created_at} />
                      </p>
                    </div>
                  </div>
                </React.Fragment>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Right: add update */}
        <div className="lg:col-span-1 space-y-4">
          {/* Meta */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Detalles</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">Período</p>
                <p className="font-medium">{report.month} {report.year}</p>
              </div>
              <Separator />
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">Creado por</p>
                <div className="flex items-center gap-2">
                  <Avatar size="sm">
                    <AvatarFallback className="text-xs">{getInitials(report.created_by_name || report.created_by_email)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{report.created_by_name || '—'}</p>
                    <p className="text-xs text-muted-foreground truncate">{report.created_by_email}</p>
                  </div>
                </div>
              </div>
              <Separator />
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">Fecha</p>
                <p className="text-sm"><TimeAgo date={report.created_at} /></p>
              </div>
            </CardContent>
          </Card>

          {/* Add update form */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Agregar Actualización</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddUpdate} className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">
                    {isReportStatusLocked(report.status)
                      ? 'Estado (información adicional)'
                      : 'Estado'}
                  </Label>
                  <Select
                    value={newStatus}
                    onValueChange={handleNewStatusChange}
                    disabled={isReportStatusLocked(report.status)}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {getAvailableReportUpdateStatuses(report).map(s => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Comentario <span className="text-destructive">*</span></Label>
                  <Textarea
                    value={newComment}
                    onChange={e => setNewComment(e.target.value)}
                    placeholder="Describe la actualización del caso..."
                    className="min-h-[100px] resize-y text-sm"
                  />
                </div>
                {submitError && (
                  <p className="text-xs text-destructive">{submitError}</p>
                )}
                <Button
                  type="submit"
                  disabled={submitting}
                  size="sm"
                  className="w-full gap-2 bg-destructive hover:bg-destructive/90 text-white"
                >
                  {submitting ? <Spinner className="size-3" /> : <Send className="size-3" />}
                  {submitting ? 'Enviando...' : 'Agregar Actualización'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Modal para ampliar imagen */}
      <Dialog open={showImageModal} onOpenChange={setShowImageModal}>
        <DialogContent className="max-w-4xl w-full bg-background border-border/50">
          <div className="relative flex items-center justify-center">
            {modalImageUrl && (
              <img
                src={modalImageUrl}
                alt="Evidencia ampliada"
                className="w-full max-h-[80vh] object-contain rounded-lg"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Audit Panel */}
      {showAuditPanel && (
        <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <History className="size-4" />
              Historial de Auditoría
            </CardTitle>
          </CardHeader>
          <CardContent className="max-h-96 overflow-y-auto space-y-2">
            {auditEvents.length === 0 ? (
              <p className="text-xs text-muted-foreground">No hay eventos registrados</p>
            ) : (
              auditEvents.map((event: any, idx: number) => (
                <div key={idx} className="border-l-2 border-amber-300 pl-3 py-2 text-xs">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-foreground">{event.action}</span>
                    <span className="text-muted-foreground">por {event.user_name || event.user_email}</span>
                  </div>
                  <p className="text-muted-foreground">{new Date(event.created_at).toLocaleString('es-ES')}</p>
                  {event.details && (
                    <p className="text-muted-foreground mt-1 italic">{event.details}</p>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}
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
