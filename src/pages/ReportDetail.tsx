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

  const summaryCards = [
    {
      label: 'TOTAL\nINFORMES',
      value: 1,
      delta: '1% vs. día anterior',
      accent: 'slate',
      icon: '🗂️',
      sparkline: [12, 18, 16, 20, 17, 22, 19],
    },
    {
      label: 'FINALIZADOS',
      value: report.status === 'Caso Finalizado' ? 1 : 0,
      delta: report.status === 'Caso Finalizado' ? '0% vs. día anterior' : '0% vs. día anterior',
      accent: 'emerald',
      icon: '✓',
      sparkline: [10, 12, 11, 13, 12, 14, 13],
    },
    {
      label: 'EN\nSEGUIMIENTO',
      value: report.status === 'Seguimiento de caso' ? 1 : 0,
      delta: '33% vs. día anterior',
      accent: 'amber',
      icon: '◔',
      sparkline: [8, 11, 14, 10, 12, 15, 13],
    },
    {
      label: 'VALIDACION',
      value: report.status === 'Validacion' ? 1 : 0,
      delta: '23% vs. día anterior',
      accent: 'violet',
      icon: '✓',
      sparkline: [9, 12, 15, 13, 14, 12, 11],
    },
    {
      label: 'INFORMATIVO',
      value: report.status === 'Informativo' ? 1 : 0,
      delta: '16% vs. día anterior',
      accent: 'sky',
      icon: 'i',
      sparkline: [11, 14, 12, 15, 17, 16, 18],
    },
  ] as const

  const accentClasses = {
    slate: 'border-slate-200 bg-slate-100/70 text-slate-700',
    emerald: 'border-emerald-200 bg-emerald-100/70 text-emerald-700',
    amber: 'border-amber-200 bg-amber-100/70 text-amber-700',
    violet: 'border-violet-200 bg-violet-100/70 text-violet-700',
    sky: 'border-sky-200 bg-sky-100/70 text-sky-700',
  } as const

  return (
    <div className="w-full space-y-5 p-4 sm:p-6 xl:p-8">
      <div className="glass-panel relative overflow-hidden rounded-[1.5rem] p-5 sm:p-6">
        <span className="brand-gradient-bg pointer-events-none absolute inset-x-0 top-0 h-1 opacity-80" aria-hidden="true" />
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon-sm" onClick={() => navigate(-1)} className="mt-0.5 shrink-0">
            <ArrowLeft className="size-4" />
          </Button>
          <div className="min-w-0 flex-1">
            <p className="mb-1.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              <span className="brand-gradient-bg size-1.5 rounded-full" aria-hidden="true" />
              Detalle de informe
            </p>
            <h1 className="truncate text-2xl font-bold tracking-tight text-foreground">{report.insured_name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{report.service_type} • {report.plate} • {report.status}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-5">
        {summaryCards.map((card) => (
          <div key={card.label} className="rounded-[1.9rem] border border-slate-200 bg-white/80 p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-2">
                <p className="whitespace-pre-line text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-500">{card.label}</p>
                <div className={`inline-flex size-10 items-center justify-center rounded-xl border ${accentClasses[card.accent]}`}>
                  <span className="text-lg font-bold">{card.icon}</span>
                </div>
              </div>
            </div>

            <div className="mt-4 text-5xl font-black tracking-[-0.06em] text-slate-900 tabular-nums">{card.value}</div>

            <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
              <span className="text-sm font-semibold text-emerald-500">↗</span>
              <span>{card.delta}</span>
            </div>

            <div className="mt-4 h-12 overflow-hidden rounded-xl bg-slate-100/80 px-2 pt-2">
              <svg viewBox="0 0 120 40" className="h-full w-full" preserveAspectRatio="none">
                <path d={card.sparkline.map((point, index) => `${index === 0 ? 'M' : 'L'} ${index * 20} ${40 - point}`).join(' ')} fill="none" stroke={
                  card.accent === 'slate' ? '#64748b' :
                  card.accent === 'emerald' ? '#10b981' :
                  card.accent === 'amber' ? '#f59e0b' :
                  card.accent === 'violet' ? '#8b5cf6' : '#0ea5e9'
                } strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Información principal</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between gap-3"><span className="text-muted-foreground">Asegurado</span><span className="font-medium text-right">{report.insured_name}</span></div>
            <div className="flex justify-between gap-3"><span className="text-muted-foreground">Placa</span><span className="font-medium text-right">{report.plate}</span></div>
            <div className="flex justify-between gap-3"><span className="text-muted-foreground">Servicio</span><span className="font-medium text-right">{report.service_type}</span></div>
            <div className="flex justify-between gap-3"><span className="text-muted-foreground">Estado</span><span className="font-medium text-right">{report.status}</span></div>
            <div className="flex justify-between gap-3"><span className="text-muted-foreground">Mes</span><span className="font-medium text-right">{report.month} {report.year}</span></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Observación</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="whitespace-pre-line text-foreground leading-relaxed">
              {observation.text || 'Sin observación adicional.'}
            </p>
            {observation.reason ? (
              <div className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary inline-block">
                Motivo: {observation.reason}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
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
