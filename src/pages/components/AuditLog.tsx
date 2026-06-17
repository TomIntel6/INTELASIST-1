import * as React from 'react'
import { AuditService } from '@/lib/audit-service'
import type { AuditLog } from '@/lib/permissions'
import { AUDIT_ACTION_LABELS, type AuditLog as AuditLogType } from '@/lib/permissions'
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
import { ChevronLeft, ChevronRight } from 'lucide-react'

const MODULES = ['', 'reports', 'users', 'evidence', 'updates', 'trash', 'system']
const ACTIONS = [
  '',
  'create_report',
  'update_report',
  'delete_report',
  'change_report_status',
  'create_user',
  'delete_user',
  'suspend_user',
]

export default function AuditLog() {
  const [logs, setLogs] = React.useState<AuditLogType[]>([])
  const [loading, setLoading] = React.useState(true)
  const [totalCount, setTotalCount] = React.useState(0)
  const [page, setPage] = React.useState(0)
  const [limit] = React.useState(20)

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
      return <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">Exitoso</Badge>
    }
    if (status === 'error') {
      return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Error</Badge>
    }

    return <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200">Pendiente</Badge>
  }

  const totalPages = Math.ceil(totalCount / limit)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Auditoría del Sistema</CardTitle>
        <CardDescription>
          Registro completo de todas las acciones realizadas en el sistema.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <Label htmlFor="email-filter" className="text-sm mb-2 block">
              Usuario (Email)
            </Label>
            <Input
              id="email-filter"
              placeholder="Buscar por email..."
              value={emailFilter}
              onChange={(e) => {
                setEmailFilter(e.target.value)
                setPage(0)
              }}
            />
          </div>

          <div>
            <Label htmlFor="module-filter" className="text-sm mb-2 block">
              Módulo
            </Label>
            <Select value={moduleFilter} onValueChange={(value) => {
              setModuleFilter(value)
              setPage(0)
            }}>
              <SelectTrigger id="module-filter">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                {MODULES.filter(m => m && m.trim() !== '').map(mod => (
                  <SelectItem key={mod} value={mod}>
                    {mod}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="action-filter" className="text-sm mb-2 block">
              Acción
            </Label>
            <Select value={actionFilter} onValueChange={(value) => {
              setActionFilter(value)
              setPage(0)
            }}>
              <SelectTrigger id="action-filter">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                {ACTIONS.filter(a => a && a.trim() !== '').map(action => (
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
        <div className="text-sm text-slate-600">
          Mostrando {logs.length} de {totalCount} registros
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-8">
            <Spinner className="size-6" />
          </div>
        )}

        {/* Logs Table */}
        {!loading && logs.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            No hay registros de auditoría con los filtros seleccionados
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50">
                  <th className="px-4 py-2 text-left font-medium">Fecha/Hora</th>
                  <th className="px-4 py-2 text-left font-medium">Usuario</th>
                  <th className="px-4 py-2 text-left font-medium">Acción</th>
                  <th className="px-4 py-2 text-left font-medium">Módulo</th>
                  <th className="px-4 py-2 text-left font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id} className="border-b hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-2 text-xs text-slate-600">
                      {formatDate(log.created_at)}
                    </td>
                    <td className="px-4 py-2">
                      <div>
                        <p className="font-medium text-slate-900">
                          {getAuditUserLabel(log)}
                        </p>
                        <p className="text-xs text-slate-500">
                          {log.user_email || log.user_id || '-'}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <Badge variant="outline">
                        {AUDIT_ACTION_LABELS[log.action] || log.action}
                      </Badge>
                    </td>
                    <td className="px-4 py-2 text-slate-700">{log.module}</td>
                    <td className="px-4 py-2">{getStatusBadge(log.status || 'pending')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        <div className="flex items-center justify-between mt-4">
          <div className="text-sm text-slate-600">
            Página {page + 1} de {Math.max(1, totalPages)}
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
  )
}
