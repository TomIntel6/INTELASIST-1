import * as React from 'react'
import { supabase } from '@/lib/supabase'
import { AuditService } from '@/lib/audit-service'
import type { AuditLog } from '@/lib/permissions'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Spinner } from '@/components/ui/spinner'
import { AUDIT_ACTION_LABELS } from '@/lib/permissions'
import { AlertCircle, CheckCircle, Clock, User, FileText } from 'lucide-react'

export default function ActivityTimeline() {
  const [events, setEvents] = React.useState<AuditLog[]>([])
  const [loading, setLoading] = React.useState(true)
  const [page, setPage] = React.useState(1)
  const [hasMore, setHasMore] = React.useState(true)

  React.useEffect(() => {
    loadEvents()
  }, [page])

  const loadEvents = async () => {
    try {
      setLoading(true)
      const response = await AuditService.fetchAuditLogs({
        limit: 20,
        offset: (page - 1) * 20,
      })

      const logs = (response.data || []) as AuditLog[]
      setEvents(logs)
      setHasMore(logs.length === 20)
    } catch (error) {
      console.error('Error loading events:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusIcon = (status: string | null) => {
    if (status === 'success') return <CheckCircle className="size-4 text-green-600" />
    if (status === 'error') return <AlertCircle className="size-4 text-red-600" />
    return <Clock className="size-4 text-slate-400" />
  }

  const getStatusBadge = (status: string | null) => {
    if (status === 'success') return <Badge className="bg-green-100 text-green-700">Éxito</Badge>
    if (status === 'error') return <Badge className="bg-red-100 text-red-700">Error</Badge>
    return <Badge className="bg-slate-100 text-slate-700">Pendiente</Badge>
  }

  const formatTime = (date: string) => {
    const d = new Date(date)
    return d.toLocaleString('es', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getModuleIcon = (module: string | null) => {
    const iconMap: Record<string, React.ReactNode> = {
      REPORTS: <FileText className="size-4" />,
      USERS: <User className="size-4" />,
    }
    return iconMap[module || ''] || <FileText className="size-4" />
  }

  if (loading && events.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Línea de Tiempo de Actividad</CardTitle>
        <CardDescription>Últimas acciones realizadas en el sistema (últimas 24 horas)</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          {events.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-slate-500">
              <p>No hay actividad reciente</p>
            </div>
          ) : (
            <div className="space-y-4">
              {events.map((event, idx) => (
                <div key={event.id} className="flex gap-4 pb-4 border-b border-slate-200 last:border-0">
                  <div className="flex flex-col items-center gap-2 pt-1">
                    {getStatusIcon(event.status)}
                    {idx !== events.length - 1 && <div className="w-0.5 h-8 bg-slate-200" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm text-slate-900">
                            {AUDIT_ACTION_LABELS[event.action] || event.action}
                          </span>
                          {getStatusBadge(event.status)}
                        </div>
                        <div className="flex items-center gap-4 text-xs text-slate-600">
                          <span className="flex items-center gap-1">
                            <User className="size-3" />
                            {event.user_name || 'Usuario desconocido'}
                          </span>
                          <span className="flex items-center gap-1">
                            {getModuleIcon(event.module)}
                            {event.module || 'Sistema'}
                          </span>
                          <span>{formatTime(event.created_at)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {hasMore && (
          <button
            onClick={() => setPage(page + 1)}
            className="mt-4 w-full px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
          >
            {loading ? 'Cargando...' : 'Cargar más'}
          </button>
        )}
      </CardContent>
    </Card>
  )
}
