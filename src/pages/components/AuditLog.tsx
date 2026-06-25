import * as React from 'react'
import { AuditService } from '@/lib/audit-service'
import type { AuditLog } from '@/lib/permissions'
import { AUDIT_ACTION_LABELS, type AuditLog as AuditLogType } from '@/lib/permissions'
import { usePermissions } from '@/lib/permissions-context'
import { API_BASE_URL } from '@/lib/auth'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import {
  ChevronLeft,
  ChevronRight,
  ScrollText,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Trash2,
  ShieldAlert,
} from 'lucide-react'

const MODULES = ['reports', 'users', 'evidence', 'updates', 'trash', 'system']
const ACTIONS = [
  'create_report',
  'update_report',
  'delete_report',
  'change_report_status',
  'create_user',
  'delete_user',
  'suspend_user',
]

export default function AuditLog() {
  const { isSupport } = usePermissions()
  const [logs, setLogs] = React.useState<AuditLogType[]>([])
  const [loading, setLoading] = React.useState(true)
  const [totalCount, setTotalCount] = React.useState(0)
  const [page, setPage] = React.useState(0)
  const [limit] = React.useState(20)
  const [deletingId, setDeletingId] = React.useState<string | null>(null)
  const [deleteError, setDeleteError] = React.useState<string | null>(null)

  // Filters
  const [moduleFilter, setModuleFilter] = React.useState('')
  const [actionFilter, setActionFilter] = React.useState('')
  const [emailFilter, setEmailFilter] = React.useState('')

  // Load logs
  React.useEffect(() => {
    loadLogs()
  }, [page, moduleFilter, actionFilter, emailFilter])

  const loadLogs = async () => {
    try {
      setLoading(true)
      const { data, count } = await AuditService.fetchAuditLogs({
        module: moduleFilter || undefined,
        action: actionFilter || undefined,
        limit,
        offset: page * limit,
      })

      // Filter by email if provided
      let filtered = data
      if (emailFilter) {
        filtered = data.filter((log: AuditLogType) =>
          log.user_email?.toLowerCase().includes(emailFilter.toLowerCase())
        )
      }

      setLogs(filtered)
      setTotalCount(count || 0)
    } catch (error) {
      console.error('Error loading audit logs:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleReset = async () => {
    setModuleFilter('')
    setActionFilter('')
    setEmailFilter('')
    setPage(0)
    // Forzar recarga de datos después de limpiar filtros
    setLoading(true)
    try {
      const { data, count } = await AuditService.fetchAuditLogs({
        limit,
        offset: 0,
      })
      setLogs(data)
      setTotalCount(count || 0)
    } catch (error) {
      console.error('Error loading audit logs:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (date: string) => {
    if (!date) return '-'

    try {
      return new Date(date).toLocaleString('es', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    } catch {
      return '-'
    }
  }

  const getAuditUserLabel = (log: AuditLogType) => {
    const fallback = log.user_email || (typeof log.user_id === 'string' ? log.user_id.slice(0, 8) : log.user_id) || 'Desconocido'
    return log.user_name && log.user_name !== 'Usuario Desconocido' ? log.user_name : fallback
  }

  const getStatusBadge = (status: string) => {
    if (status === 'success') {
      return (
        <Badge variant="outline" className="gap-1 border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="size-3" aria-hidden="true" />
          Exitoso
        </Badge>
      )
    }
    if (status === 'error') {
      return (
        <Badge variant="outline" className="gap-1 border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400">
          <XCircle className="size-3" aria-hidden="true" />
          Error
        </Badge>
      )
    }

    return (
      <Badge variant="outline" className="gap-1 border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400">
        <Clock className="size-3" aria-hidden="true" />
        Pendiente
      </Badge>
    )
  }

  const totalPages = Math.ceil(totalCount / limit)

  const handleDeleteLog = async (auditId: string) => {
    if (!isSupport) return

    if (!window.confirm('¿Eliminar este registro de auditoría? Esta acción no se puede deshacer.')) {
      return
    }

    setDeleteError(null)
    setDeletingId(auditId)

    try {
      const response = await fetch(`${API_BASE_URL}/api/audit-logs/${encodeURIComponent(auditId)}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const body = await response.json().catch(() => null)
        const message = body?.error || response.statusText || 'Error al eliminar registro de auditoría'
        throw new Error(message)
      }

      await loadLogs()
    } catch (err) {
      console.error('Error deleting audit log:', err)
      setDeleteError(err instanceof Error ? err.message : 'Error al eliminar registro de auditoría')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="glass-panel relative overflow-hidden rounded-xl p-6">
        <span className="brand-gradient-bg absolute inset-x-0 top-0 h-1" aria-hidden="true" />
        <div className="flex items-start gap-4">
          <span className="brand-monogram flex size-11 shrink-0 items-center justify-center rounded-xl">
            <ScrollText className="size-5" aria-hidden="true" />
          </span>
          <div>
            <p className="mb-1.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              <span className="brand-gradient-bg size-1.5 rounded-full" aria-hidden="true" />
              Auditoría
            </p>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Auditoría del Sistema</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Registro completo de todas las acciones realizadas en el sistema.
            </p>
          </div>
        </div>
      </div>

      <Card>
      <CardHeader>
        <CardTitle className="text-base">Filtros</CardTitle>
        <CardDescription>
          Refina el listado por usuario, módulo o tipo de acción.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <Label htmlFor="email-filter" className="text-sm font-medium mb-2 block">
              Usuario (Email)
            </Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                id="email-filter"
                placeholder="Buscar por email..."
                value={emailFilter}
                onChange={(e) => {
                  setEmailFilter(e.target.value)
                  setPage(0)
                }}
                className="pl-9"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="module-filter" className="text-sm font-medium mb-2 block">
              Módulo
            </Label>
            <Select value={moduleFilter} onValueChange={(value) => {
              const v = value === '__all__' ? '' : value
              setModuleFilter(v)
              setPage(0)
            }}>
              <SelectTrigger id="module-filter">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos</SelectItem>
                {MODULES.map(mod => (
                  <SelectItem key={mod} value={mod}>
                    {mod}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="action-filter" className="text-sm font-medium mb-2 block">
              Acción
            </Label>
            <Select value={actionFilter} onValueChange={(value) => {
              const v = value === '__all__' ? '' : value
              setActionFilter(v)
              setPage(0)
            }}>
              <SelectTrigger id="action-filter">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todas</SelectItem>
                {ACTIONS.map(action => (
                  <SelectItem key={action} value={action}>
                    {AUDIT_ACTION_LABELS[action] || action}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-end">
            <Button onClick={handleReset} variant="outline" className="w-full">
              Limpiar Filtros
            </Button>
          </div>
        </div>

        {/* Results Count */}
        <div className="text-sm text-muted-foreground">
          Mostrando <span className="font-medium text-foreground tabular-nums">{logs.length}</span> de{' '}
          <span className="font-medium text-foreground tabular-nums">{totalCount}</span> registros
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-8">
            <Spinner className="size-6" />
          </div>
        )}

        {/* Logs Table */}
        {deleteError && (
          <div className="flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
            <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>{deleteError}</span>
          </div>
        )}
        {!loading && logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-border py-12 text-center">
            <span className="flex size-10 items-center justify-center rounded-xl bg-muted text-muted-foreground ring-1 ring-border">
              <ScrollText className="size-5" aria-hidden="true" />
            </span>
            <p className="text-sm text-muted-foreground">
              No hay registros de auditoría con los filtros seleccionados
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Fecha/Hora</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Usuario</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Acción</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Módulo</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Estado</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map(log => (
                    <tr key={log.id} className="border-b border-border transition-colors last:border-0 hover:bg-accent">
                      <td className="px-4 py-3 text-xs tabular-nums text-muted-foreground">
                        {formatDate(log.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-foreground">
                            {getAuditUserLabel(log)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {log.user_email || log.user_id || '-'}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="border-sky-500/20 bg-sky-500/10 text-sky-600 dark:text-sky-400">
                          {AUDIT_ACTION_LABELS[log.action] || log.action}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-foreground">{log.module}</td>
                      <td className="px-4 py-3">{getStatusBadge(log.status || 'pending')}</td>
                      <td className="px-4 py-3 text-right">
                        {isSupport ? (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDeleteLog(String(log.id))}
                            disabled={deletingId === String(log.id)}
                          >
                            <Trash2 className="size-4" aria-hidden="true" />
                            {deletingId === String(log.id) ? 'Eliminando…' : 'Eliminar'}
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">Solo Support</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Pagination */}
        <div className="flex items-center justify-between mt-4">
          <div className="text-sm text-muted-foreground">
            Página <span className="font-medium text-foreground tabular-nums">{page + 1}</span> de{' '}
            <span className="font-medium text-foreground tabular-nums">{Math.max(1, totalPages)}</span>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0 || loading}
              variant="outline"
              size="sm"
            >
              <ChevronLeft className="size-4" />
              Anterior
            </Button>
            <Button
              onClick={() => setPage(page + 1)}
              disabled={page >= totalPages - 1 || loading}
              variant="outline"
              size="sm"
            >
              Siguiente
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
    </div>
  )
}
