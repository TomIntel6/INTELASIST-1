import * as React from 'react'
import { supabase } from '@/lib/supabase'
import { UserManagementService } from '@/lib/user-management'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Spinner } from '@/components/ui/spinner'
import { AlertTriangle, CheckCircle2, AlertCircle, Zap, Users, Clock } from 'lucide-react'

interface HealthIndicator {
  name: string
  status: 'healthy' | 'warning' | 'error'
  message: string
  icon: React.ReactNode
}

export default function SystemHealth() {
  const [indicators, setIndicators] = React.useState<HealthIndicator[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    checkHealth()
    const interval = setInterval(checkHealth, 30000) // Check every 30 seconds
    return () => clearInterval(interval)
  }, [])

  const checkHealth = async () => {
    try {
      const checks: HealthIndicator[] = []

      // Check 1: Database connectivity
      try {
        const { data, error } = await supabase.from('audit_logs').select('id').limit(1)
        checks.push({
          name: 'Base de Datos',
          status: error ? 'error' : 'healthy',
          message: error ? 'No se puede conectar a la base de datos' : 'Conexión activa',
          icon: <Zap className="size-4" />,
        })
      } catch (err) {
        checks.push({
          name: 'Base de Datos',
          status: 'error',
          message: 'Error de conexión',
          icon: <Zap className="size-4" />,
        })
      }

      // Check 2: Auth service
      try {
        const response = await fetch('https://intelasist.onrender.com/api/health/auth')
        const health = await response.json()
        
        checks.push({
          name: 'Servicio de Autenticación',
          status: health.status === 'healthy' ? 'healthy' : 'error',
          message: health.message || `${health.userCount || 0} usuarios registrados`,
          icon: <Users className="size-4" />,
        })
      } catch (err) {
        checks.push({
          name: 'Servicio de Autenticación',
          status: 'error',
          message: 'Servicio no disponible',
          icon: <Users className="size-4" />,
        })
      }

      // Check 3: User suspension status
      try {
        const stats = await UserManagementService.getActivityStatistics()
        const suspensionRatio = stats.totalUsers > 0 ? (stats.suspendedUsers / stats.totalUsers) * 100 : 0

        checks.push({
          name: 'Estado de Usuarios',
          status: suspensionRatio > 30 ? 'warning' : suspensionRatio > 50 ? 'error' : 'healthy',
          message:
            suspensionRatio > 50
              ? `⚠️ ${suspensionRatio.toFixed(1)}% de usuarios suspendidos`
              : suspensionRatio > 30
                ? `Advertencia: ${suspensionRatio.toFixed(1)}% suspendidos`
                : `${stats.activeUsers}/${stats.totalUsers} usuarios activos`,
          icon: <Users className="size-4" />,
        })
      } catch (err) {
        checks.push({
          name: 'Estado de Usuarios',
          status: 'warning',
          message: 'No se puede verificar estado',
          icon: <Users className="size-4" />,
        })
      }

      // Check 4: Trash accumulation
      try {
        const { data: trash } = await supabase.from('deleted_reports').select('id').eq('permanently_deleted_at', null)
        const trashCount = trash?.length || 0
        const status = trashCount > 100 ? 'warning' : trashCount > 500 ? 'error' : 'healthy'

        checks.push({
          name: 'Papelera',
          status,
          message: trashCount > 0 ? `${trashCount} elementos en papelera` : 'Papelera vacía',
          icon: trashCount > 100 ? <AlertTriangle className="size-4" /> : <CheckCircle2 className="size-4" />,
        })
      } catch (err) {
        checks.push({
          name: 'Papelera',
          status: 'warning',
          message: 'No se puede verificar',
          icon: <AlertCircle className="size-4" />,
        })
      }

      // Check 5: Recent activity
      try {
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
        const { data: recentActivity } = await supabase
          .from('audit_logs')
          .select('id')
          .gte('created_at', oneDayAgo)
          .limit(1)

        checks.push({
          name: 'Actividad del Sistema',
          status: recentActivity && recentActivity.length > 0 ? 'healthy' : 'warning',
          message:
            recentActivity && recentActivity.length > 0
              ? 'Sistema con actividad normal'
              : 'Sin actividad en las últimas 24h',
          icon: <Clock className="size-4" />,
        })
      } catch (err) {
        checks.push({
          name: 'Actividad del Sistema',
          status: 'warning',
          message: 'No se puede verificar',
          icon: <Clock className="size-4" />,
        })
      }

      setIndicators(checks)
    } catch (error) {
      console.error('Error checking health:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const badges: Record<string, React.ReactNode> = {
      healthy: (
        <Badge className="bg-green-100 text-green-700 gap-1">
          <CheckCircle2 className="size-3" /> Saludable
        </Badge>
      ),
      warning: (
        <Badge className="bg-amber-100 text-amber-700 gap-1">
          <AlertTriangle className="size-3" /> Advertencia
        </Badge>
      ),
      error: (
        <Badge className="bg-red-100 text-red-700 gap-1">
          <AlertCircle className="size-3" /> Error
        </Badge>
      ),
    }
    return badges[status] || badges.warning
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    )
  }

  const hasErrors = indicators.some((i) => i.status === 'error')
  const hasWarnings = indicators.some((i) => i.status === 'warning')

  return (
    <div className="space-y-6">
      {(hasErrors || hasWarnings) && (
        <Alert variant={hasErrors ? 'destructive' : 'default'}>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{hasErrors ? 'Problemas detectados' : 'Advertencias del sistema'}</AlertTitle>
          <AlertDescription>
            {hasErrors
              ? 'Se han detectado errores que requieren atención inmediata.'
              : 'Se han detectado advertencias que pueden requerir revisión.'}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4">
        {indicators.map((indicator) => (
          <Card key={indicator.name}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <div className="text-slate-600">{indicator.icon}</div>
                  <div className="flex-1">
                    <p className="font-medium text-slate-900">{indicator.name}</p>
                    <p className="text-sm text-slate-600">{indicator.message}</p>
                  </div>
                </div>
                {getStatusBadge(indicator.status)}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recomendaciones</CardTitle>
          <CardDescription>Acciones sugeridas basadas en el estado actual</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            {indicators
              .filter((i) => i.status !== 'healthy')
              .map((indicator) => (
                <div key={indicator.name} className="flex items-start gap-2 p-2 bg-slate-50 rounded">
                  <AlertCircle className="size-4 mt-0.5 text-amber-600 flex-shrink-0" />
                  <div>
                    <span className="font-medium">{indicator.name}:</span> Revisa el estado y toma las acciones
                    necesarias
                  </div>
                </div>
              ))}
            {indicators.every((i) => i.status === 'healthy') && (
              <div className="flex items-start gap-2 p-2 bg-green-50 rounded">
                <CheckCircle2 className="size-4 mt-0.5 text-green-600 flex-shrink-0" />
                <span>Todos los sistemas funcionan correctamente</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <button
        onClick={checkHealth}
        className="w-full px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
      >
        Verificar ahora
      </button>
    </div>
  )
}
