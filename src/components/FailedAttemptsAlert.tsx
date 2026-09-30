import * as React from 'react'
import { AlertCircle, AlertTriangle, CheckCircle2, Clock3, RefreshCw, Trash2, UserRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { getDefaultApiBase } from '@/lib/supabase'
import { PERMISSIONS } from '@/lib/permissions'
import { useAuth, getUserRoles } from '@/lib/auth'
import { usePermissions } from '@/lib/permissions-context'

type FailedAttempt = {
  id: string | number
  email: string
  name: string
  attemptedAt?: string
  missingFieldLabels?: string[]
  completedFieldLabels?: string[]
  missingDetails?: Array<{ field: string; label: string; value: string }>
  completedDetails?: Array<{ field: string; label: string; value: string }>
}

const REFRESH_INTERVAL_MS = 10 * 60 * 1000

export default function FailedAttemptsAlert() {
  const { user } = useAuth()
  const { permissions, hasPermission } = usePermissions()
  const [attempts, setAttempts] = React.useState<FailedAttempt[]>([])
  const [open, setOpen] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [loadError, setLoadError] = React.useState<string | null>(null)
  const roles = React.useMemo(() => getUserRoles(user), [user])
  const rawPermissions = React.useMemo<Record<string, boolean>>(() => permissions?.permissions ?? {}, [permissions])
  const canView = Boolean(rawPermissions[PERMISSIONS.SYSTEM.VIEW_ALERTS]) || hasPermission(PERMISSIONS.SYSTEM.VIEW_ALERTS)
  const canManage = Boolean(rawPermissions[PERMISSIONS.SYSTEM.MANAGE_ALERTS]) || hasPermission(PERMISSIONS.SYSTEM.MANAGE_ALERTS)
  const canAccess = canView || roles.some(role => ['Admin', 'Support', 'Gerente'].includes(role))

  const loadAttempts = React.useCallback(async () => {
    if (!canAccess || document.visibilityState !== 'visible') return
    setLoading(true)
    setLoadError(null)
    try {
      const response = await fetch(`${getDefaultApiBase()}/failed-report-attempts/raw`, { credentials: 'include' })
      if (!response.ok) throw new Error('No se pudieron cargar las alertas de informes.')
      const data = await response.json()
      const nextAttempts = Array.isArray(data.attempts) ? data.attempts : []
      setAttempts(nextAttempts.map((attempt: any) => ({
        ...attempt,
        missingFieldLabels: Array.isArray(attempt.missingFieldLabels) ? attempt.missingFieldLabels : attempt.missing_field_labels ?? [],
        completedFieldLabels: Array.isArray(attempt.completedFieldLabels) ? attempt.completedFieldLabels : attempt.completed_field_labels ?? [],
        missingDetails: Array.isArray(attempt.missingDetails) ? attempt.missingDetails : attempt.missing_details ?? [],
        completedDetails: Array.isArray(attempt.completedDetails) ? attempt.completedDetails : attempt.completed_details ?? [],
      })))
    } catch (error) {
      console.error('Error al cargar intentos fallidos:', error)
      setLoadError(error instanceof Error ? error.message : 'Ocurrió un error al consultar las alertas.')
    } finally {
      setLoading(false)
    }
  }, [canAccess])

  React.useEffect(() => {
    if (!canAccess) {
      setAttempts([])
      return
    }
    const refresh = () => void loadAttempts()
    const interval = window.setInterval(refresh, REFRESH_INTERVAL_MS)
    window.addEventListener('failedAttemptRegistered', refresh)
    window.addEventListener('storage', refresh)
    window.addEventListener('visibilitychange', refresh)
    refresh()
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('failedAttemptRegistered', refresh)
      window.removeEventListener('storage', refresh)
      window.removeEventListener('visibilitychange', refresh)
    }
  }, [canAccess, loadAttempts])

  React.useEffect(() => {
    if (open) void loadAttempts()
  }, [open, loadAttempts])

  const deleteAttempt = async (id: string | number) => {
    if (!canManage) return
    try {
      const response = await fetch(`${getDefaultApiBase()}/failed-report-attempts/${id}`, { method: 'DELETE', credentials: 'include' })
      if (response.ok) setAttempts(previous => previous.filter(attempt => Number(attempt.id) !== Number(id)))
    } catch (error) {
      console.error('Error borrando intento:', error)
    }
  }

  if (!canAccess) return null

  const affectedUsers = new Set(attempts.map(attempt => (attempt.email || String(attempt.id)).toLowerCase())).size

  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => setOpen(true)}
        className="relative rounded-xl border border-border/70 bg-background/70 text-muted-foreground shadow-sm transition-all hover:scale-[1.02] hover:bg-accent hover:text-foreground"
        aria-label="Alertas de informes incompletos"
        title={attempts.length > 0 ? `${attempts.length} usuario(s) con intentos incompletos` : 'Sin alertas'}
      >
        <AlertCircle className={`size-4 ${attempts.length > 0 ? 'animate-pulse' : ''}`} />
        {attempts.length > 0 ? <span className="absolute -top-1 -right-1 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-amber-500 px-1.5 text-[10px] font-semibold text-white">{attempts.length > 9 ? '9+' : attempts.length}</span> : null}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[88vh] overflow-hidden p-0 sm:max-w-3xl">
          <div className="flex max-h-[88vh] flex-col">
            <DialogHeader className="shrink-0 border-b border-border/70 px-6 py-5 text-left">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:pr-8">
                <div className="flex items-start gap-3">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-amber-200 bg-amber-50 text-amber-700">
                    <AlertCircle className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="mb-1.5 flex flex-wrap items-center gap-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Control de informes</p>
                      <Badge variant="outline" className={attempts.length > 0
                        ? 'border-amber-200 bg-amber-50 text-amber-800'
                        : 'border-emerald-200 bg-emerald-50 text-emerald-800'}>
                        {attempts.length > 0 ? 'Requiere atención' : 'Al día'}
                      </Badge>
                    </div>
                    <DialogTitle className="text-xl font-semibold tracking-tight">Intentos incompletos</DialogTitle>
                    <DialogDescription className="mt-1 max-w-xl">
                      Personas que iniciaron un informe y dejaron datos pendientes.
                    </DialogDescription>
                  </div>
                </div>
                <Button onClick={() => void loadAttempts()} variant="outline" size="sm" disabled={loading} className="shrink-0 gap-2 self-start">
                  <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
                  Actualizar
                </Button>
              </div>
              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                <div className="flex items-center gap-3 rounded-lg border border-border/70 bg-muted/40 px-3.5 py-3">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-background text-amber-700">
                    <AlertTriangle className="size-4" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Intentos registrados</p>
                    <p className="font-semibold tabular-nums text-foreground">{attempts.length}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-lg border border-border/70 bg-muted/40 px-3.5 py-3">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-background text-sky-700">
                    <UserRound className="size-4" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Personas afectadas</p>
                    <p className="font-semibold tabular-nums text-foreground">{affectedUsers}</p>
                  </div>
                </div>
              </div>
            </DialogHeader>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              {loadError ? (
                <div role="alert" className="mb-4 flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-800">
                  <AlertTriangle className="size-4 shrink-0" />
                  <span>{loadError}</span>
                </div>
              ) : null}

              {loading && attempts.length === 0 ? (
                <div className="flex min-h-40 flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
                  <RefreshCw className="size-5 animate-spin text-primary" />
                  Consultando intentos incompletos...
                </div>
              ) : attempts.length === 0 && !loadError ? (
                <div className="flex min-h-48 flex-col items-center justify-center gap-3 text-center">
                  <div className="flex size-11 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
                    <CheckCircle2 className="size-5" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Sin alertas pendientes</p>
                    <p className="mt-1 text-sm text-muted-foreground">No hay informes incompletos que revisar.</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {attempts.map(attempt => {
                    const completedDetailLabels = attempt.completedDetails?.map(item => item.label) ?? []
                    const missingDetailLabels = attempt.missingDetails?.map(item => item.label) ?? []
                    const completedLabels = completedDetailLabels.length > 0 ? completedDetailLabels : attempt.completedFieldLabels ?? []
                    const missingLabels = missingDetailLabels.length > 0 ? missingDetailLabels : attempt.missingFieldLabels ?? []

                    return (
                      <article key={`${attempt.id}-${attempt.email}`} className="rounded-lg border border-border/70 bg-card p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="flex min-w-0 items-start gap-3">
                            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground">
                              {(attempt.name || attempt.email || '?').trim().charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-foreground">{attempt.name || attempt.email || 'Usuario desconocido'}</p>
                              <p className="truncate text-xs text-muted-foreground">{attempt.email || 'Sin correo registrado'}</p>
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center justify-between gap-3 sm:justify-end">
                            {attempt.attemptedAt ? (
                              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Clock3 className="size-3.5" />
                                {new Date(attempt.attemptedAt).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })}
                              </span>
                            ) : null}
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => void deleteAttempt(attempt.id)}
                              disabled={!canManage}
                              aria-label={`Eliminar intento de ${attempt.name || attempt.email || 'usuario'}`}
                              title={canManage ? 'Eliminar intento' : 'No tienes permiso para eliminar intentos'}
                              className="text-muted-foreground hover:bg-rose-50 hover:text-rose-700"
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </div>

                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          <div className="rounded-md border border-emerald-200/80 bg-emerald-50/60 p-3">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-xs font-semibold text-emerald-900">Completados</p>
                              <span className="text-xs tabular-nums text-emerald-800">{completedLabels.length}</span>
                            </div>
                            <p className="mt-1.5 text-xs leading-5 text-emerald-900/80">{completedLabels.join(', ') || 'Ninguno'}</p>
                          </div>
                          <div className="rounded-md border border-amber-200/80 bg-amber-50/70 p-3">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-xs font-semibold text-amber-900">Pendientes</p>
                              <span className="text-xs tabular-nums text-amber-800">{missingLabels.length}</span>
                            </div>
                            <p className="mt-1.5 text-xs leading-5 text-amber-900/80">{missingLabels.join(', ') || 'Ninguno'}</p>
                          </div>
                        </div>
                      </article>
                    )
                  })}
                </div>
              )}
            </div>
            <DialogFooter className="shrink-0 border-t border-border/70 px-6 py-4">
              <Button variant="outline" onClick={() => setOpen(false)}>Cerrar</Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
