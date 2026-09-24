import * as React from 'react'
import { AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
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
  const roles = React.useMemo(() => getUserRoles(user), [user])
  const rawPermissions = React.useMemo<Record<string, boolean>>(() => permissions?.permissions ?? {}, [permissions])
  const canView = Boolean(rawPermissions[PERMISSIONS.SYSTEM.VIEW_ALERTS]) || hasPermission(PERMISSIONS.SYSTEM.VIEW_ALERTS)
  const canManage = Boolean(rawPermissions[PERMISSIONS.SYSTEM.MANAGE_ALERTS]) || hasPermission(PERMISSIONS.SYSTEM.MANAGE_ALERTS)
  const canAccess = canView || roles.some(role => ['Admin', 'Support', 'Gerente'].includes(role))

  const loadAttempts = React.useCallback(async () => {
    if (!canAccess || document.visibilityState !== 'visible') return
    try {
      const response = await fetch(`${getDefaultApiBase()}/failed-report-attempts/raw`, { credentials: 'include' })
      if (!response.ok) return
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
        <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600"><AlertCircle className="size-5" />Alertas de Informes Incompletos</DialogTitle>
            <DialogDescription>Usuarios que intentaron crear informes pero dejaron campos incompletos.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {attempts.length === 0 ? <p className="py-4 text-center text-sm text-muted-foreground">No hay alertas pendientes</p> : attempts.map(attempt => (
              <div key={`${attempt.id}-${attempt.email}`} className="space-y-2 rounded-lg border border-amber-200 bg-amber-50/50 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{attempt.name || attempt.email}</p>
                    <p className="truncate text-xs text-muted-foreground">{attempt.email}</p>
                    <p className="mt-1 text-xs text-muted-foreground">No completó el informe.</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {attempt.attemptedAt ? <span className="text-xs text-muted-foreground">{new Date(attempt.attemptedAt).toLocaleDateString('es-ES')}</span> : null}
                    <Button variant="outline" size="sm" onClick={() => deleteAttempt(attempt.id)} disabled={!canManage}>Borrar</Button>
                  </div>
                </div>
                <div className="grid gap-2 text-xs">
                  <div className="rounded-md border border-emerald-200 bg-emerald-50/70 p-2 text-emerald-900"><strong>Completados:</strong> {attempt.completedDetails?.map(item => item.label).join(', ') || attempt.completedFieldLabels?.join(', ') || 'Ninguno'}</div>
                  <div className="rounded-md border border-amber-200 bg-amber-50/70 p-2 text-amber-900"><strong>Incompletos:</strong> {attempt.missingDetails?.map(item => item.label).join(', ') || attempt.missingFieldLabels?.join(', ') || 'Ninguno'}</div>
                </div>
              </div>
            ))}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cerrar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
