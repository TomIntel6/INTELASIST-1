import * as React from 'react'
import { supabase } from '@/lib/supabase'
import { AuditService } from '@/lib/audit-service'
import type { AuditLog } from '@/lib/permissions'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AUDIT_ACTION_LABELS, AUDIT_ACTIONS } from '@/lib/permissions'
import { Download, Filter } from 'lucide-react'
import { toast } from 'sonner'

export default function AuditReports() {
  const [logs, setLogs] = React.useState<AuditLog[]>([])
  const [loading, setLoading] = React.useState(true)
  const [module, setModule] = React.useState<string>('')
  const [action, setAction] = React.useState<string>('')
  const [startDate, setStartDate] = React.useState<string>('')
  const [endDate, setEndDate] = React.useState<string>('')
  const [email, setEmail] = React.useState<string>('')
  const [page, setPage] = React.useState(1)

  React.useEffect(() => {
    loadLogs()
  }, [module, action, startDate, endDate, email, page])

  const loadLogs = async () => {
    try {
      setLoading(true)
      const response = await AuditService.fetchAuditLogs({
        module: module || undefined,
        action: action || undefined,
        startDate: startDate ? new Date(startDate).toISOString() : undefined,
        endDate: endDate ? new Date(endDate).toISOString() : undefined,
        limit: 50,
        offset: (page - 1) * 50,
      })
      setLogs((response.data || []) as AuditLog[])
    } catch (error) {
      console.error('Error loading logs:', error)
      toast.error('Error cargando registros')
    } finally {
      setLoading(false)
    }
  }

  const handleExport = async () => {
    try {
      const data = logs.map((log) => ({
        fecha: new Date(log.created_at).toLocaleString('es'),
        usuario: log.user_id,
        acción: AUDIT_ACTION_LABELS[log.action] || log.action,
        módulo: log.module,
        estado: log.status,
        entidad: log.entity_id,
        detalles: log.details,
      }))

      const csv =
        [Object.keys(data[0] || {}).join(','), ...data.map((row) => Object.values(row).join(','))].join('\n')

      const blob = new Blob([csv], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `auditoria-${new Date().toISOString().split('T')[0]}.csv`
      a.click()
      window.URL.revokeObjectURL(url)

      toast.success('Reporte exportado')
    } catch (error) {
      console.error('Error exporting:', error)
      toast.error('Error exportando reporte')
    }
  }

  const handleClearFilters = () => {
    setModule('')
    setAction('')
    setStartDate('')
    setEndDate('')
    setEmail('')
    setPage(1)
  }

  const formatDateTime = (date: string) => {
    return new Date(date).toLocaleString('es', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  const getStatusColor = (status: string | null) => {
    if (status === 'success') return 'bg-green-100 text-green-700'
    if (status === 'error') return 'bg-red-100 text-red-700'
    return 'bg-slate-100 text-slate-700'
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Filtros de Auditoría</CardTitle>
          <CardDescription>Busca registros de auditoría específicos</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email del Usuario</Label>
              <Input
                id="email"
                placeholder="usuario@ejemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="module">Módulo</Label>
              <Select value={module} onValueChange={setModule}>
                <SelectTrigger id="module">
                  <SelectValue placeholder="Todos los módulos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todos</SelectItem>
                  <SelectItem value="REPORTS">Informes</SelectItem>
                  <SelectItem value="USERS">Usuarios</SelectItem>
                  <SelectItem value="SYSTEM">Sistema</SelectItem>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="action">Acción</Label>
              <Select value={action} onValueChange={setAction}>
                <SelectTrigger id="action">
                  <SelectValue placeholder="Todas las acciones" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todas</SelectItem>
                  {AUDIT_ACTIONS.map((act) => (
                    <SelectItem key={act} value={act}>
                      {AUDIT_ACTION_LABELS[act] || act}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="startDate">Fecha Inicio</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="endDate">Fecha Fin</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>

            <div className="flex items-end gap-2">
              <Button onClick={handleClearFilters} variant="outline" className="flex-1">
                <Filter className="size-4 mr-2" />
                Limpiar
              </Button>
              <Button onClick={handleExport} className="flex-1">
                <Download className="size-4 mr-2" />
                Exportar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Registros de Auditoría</CardTitle>
          <CardDescription>{logs.length} registros encontrados</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Spinner />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <p>No hay registros que coincidan con los filtros</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium">Fecha/Hora</th>
                    <th className="text-left px-4 py-2 font-medium">Usuario</th>
                    <th className="text-left px-4 py-2 font-medium">Acción</th>
                    <th className="text-left px-4 py-2 font-medium">Módulo</th>
                    <th className="text-left px-4 py-2 font-medium">Entidad</th>
                    <th className="text-left px-4 py-2 font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-b border-slate-200 hover:bg-slate-50">
                      <td className="px-4 py-2 text-xs">{formatDateTime(log.created_at)}</td>
                      <td className="px-4 py-2 text-xs font-medium">{(log.user_id || '-').slice(0, 8)}...</td>
                      <td className="px-4 py-2 text-xs">
                        {AUDIT_ACTION_LABELS[log.action] || log.action}
                      </td>
                      <td className="px-4 py-2 text-xs">
                        <Badge variant="outline">{log.module}</Badge>
                      </td>
                      <td className="px-4 py-2 text-xs text-slate-600">{log.entity_id?.slice(0, 8) || '-'}</td>
                      <td className="px-4 py-2">
                        <Badge className={getStatusColor(log.status)}>
                          {log.status === 'success' ? 'Éxito' : log.status === 'error' ? 'Error' : 'Pendiente'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {logs.length === 50 && (
            <div className="mt-4 flex justify-center">
              <Button onClick={() => setPage(page + 1)} variant="outline">
                Cargar más
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
