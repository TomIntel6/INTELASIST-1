import * as React from 'react'
import { getDefaultApiBase } from '@/lib/supabase'
import { UserManagementService } from '@/lib/user-management'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const API_BASE = getDefaultApiBase()
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import { AlertTriangle, CheckCircle2, AlertCircle, Zap, Users, Clock, Activity, RefreshCw } from 'lucide-react'

interface HealthIndicator {
  name: string
  status: 'healthy' | 'warning' | 'error'
  message: string
  icon: React.ReactNode
}

/** Estilos semánticos de chip por estado (claro + dark), reutilizando la escala del tema. */
const STATUS_STYLES: Record<HealthIndicator['status'], { chip: string; bar: string }> = {
  healthy: {
    chip: 'bg-emerald-500/10 text-emerald-600 ring-emerald-500/20 dark:text-emerald-400',
    bar: 'bg-emerald-500/70',
  },
  warning: {
    chip: 'bg-amber-500/10 text-amber-600 ring-amber-500/20 dark:text-amber-400',
    bar: 'bg-amber-500/70',
  },
  error: {
    chip: 'bg-red-500/10 text-red-600 ring-red-500/20 dark:text-red-400',
    bar: 'bg-red-500/70',
  },
}

export default function SystemHealth() {
  const [indicators, setIndicators] = React.useState<HealthIndicator[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    const refreshIfVisible = () => {
      if (document.visibilityState === 'visible') {
        void checkHealth()
      }
    }

    void checkHealth()
    window.addEventListener('visibilitychange', refreshIfVisible)
    window.addEventListener('focus', refreshIfVisible)

    return () => {
      window.removeEventListener('visibilitychange', refreshIfVisible)
      window.removeEventListener('focus', refreshIfVisible)
    }
  }, [])

  const checkHealth = async () => {
    try {
      const checks: HealthIndicator[] = []

      // Check 1: Database connectivity (via auth health endpoint)
      try {
        const response = await fetch(`${API_BASE}/api/health/auth`)
        const health = await response.json()
        
        checks.push({
          name: 'Base de Datos',
          status: response.ok ? 'healthy' : 'error',
          message: response.ok ? 'Conexión activa' : 'No se puede conectar a la base de datos',
          icon: <Zap className="size-5" />,
        })
      } catch (err) {
        checks.push({
          name: 'Base de Datos',
          status: 'error',
          message: 'Error de conexión',
          icon: <Zap className="size-5" />,
        })
      }

      // Check 2: Auth service
      try {
        const response = await fetch(`${API_BASE}/api/health/auth`)
        const health = await response.json()
        
        checks.push({
          name: 'Servicio de Autenticación',
          status: health.status === 'healthy' ? 'healthy' : 'error',
          message: health.message || `${health.userCount || 0} usuarios registrados`,
          icon: <Users className="size-5" />,
        })
      } catch (err) {
        checks.push({
          name: 'Servicio de Autenticación',
          status: 'error',
          message: 'Servicio no disponible',
          icon: <Users className="size-5" />,
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
          icon: <Users className="size-5" />,
        })
      } catch (err) {
        checks.push({
          name: 'Estado de Usuarios',
          status: 'warning',
          message: 'No se puede verificar estado',
          icon: <Users className="size-5" />,
        })
      }

      // Check 4: Trash accumulation
      try {
        const response = await fetch(`${API_BASE}/api/trash/stats`)
        const trashData = await response.json()
        const trashCount = trashData.totalDeleted || 0
        const status = trashCount > 100 ? 'warning' : trashCount > 500 ? 'error' : 'healthy'

        checks.push({
          name: 'Papelera',
          status,
          message: trashCount > 0 ? `${trashCount} elementos en papelera` : 'Papelera vacía',
          icon: trashCount > 100 ? <AlertTriangle className="size-5" /> : <CheckCircle2 className="size-5" />,
        })
      } catch (err) {
        checks.push({
          name: 'Papelera',
          status: 'warning',
          message: 'No se puede verificar',
          icon: <AlertCircle className="size-5" />,
        })
      }

      // Check 5: Recent activity
      try {
        const response = await fetch(`${API_BASE}/api/audit-logs?limit=1`)
        const auditData = await response.json()
        const hasActivity = auditData.data && auditData.data.length > 0

        checks.push({
          name: 'Actividad del Sistema',
          status: hasActivity ? 'healthy' : 'warning',
          message: hasActivity ? 'Sistema con actividad normal' : 'Sin actividad en las últimas 24h',
          icon: <Clock className="size-5" />,
        })
      } catch (err) {
        checks.push({
          name: 'Actividad del Sistema',
          status: 'warning',
          message: 'No se puede verificar',
          icon: <Clock className="size-5" />,
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
        <Badge className="gap-1 border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="size-3" /> Saludable
        </Badge>
      ),
      warning: (
        <Badge className="gap-1 border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400">
          <AlertTriangle className="size-3" /> Advertencia
        </Badge>
      ),
      error: (
        <Badge className="gap-1 border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400">
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="mb-1.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            <span className="brand-gradient-bg size-1.5 rounded-full" aria-hidden="true" />
            Administración
          </p>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground">
            <Activity className="size-6 text-muted-foreground" aria-hidden="true" />
            Salud del sistema
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">Métricas y estado de los servicios en tiempo real</p>
        </div>
        <Button onClick={checkHealth} variant="outline" size="sm" className="gap-2 self-start">
          <RefreshCw className="size-4" />
          Verificar ahora
        </Button>
      </div>

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

      <div className="grid gap-4 sm:grid-cols-2">
        {indicators.map((indicator) => {
          const styles = STATUS_STYLES[indicator.status]
          return (
            <Card
              key={indicator.name}
              className="hover-lift relative overflow-hidden border bg-card shadow-sm transition-all hover:shadow-md"
            >
              <span className={cn('absolute inset-x-0 top-0 h-0.5', styles.bar)} aria-hidden="true" />
              <CardContent className="pt-6">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex flex-1 items-center gap-3">
                    <span
                      className={cn(
                        'flex size-10 shrink-0 items-center justify-center rounded-xl ring-1',
                        styles.chip,
                      )}
                    >
                      {indicator.icon}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {indicator.name}
                      </p>
                      <p className="text-sm font-medium text-foreground">{indicator.message}</p>
                    </div>
                  </div>
                  {getStatusBadge(indicator.status)}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card className="border bg-card shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-foreground">Recomendaciones</CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Acciones sugeridas basadas en el estado actual
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            {indicators
              .filter((i) => i.status !== 'healthy')
              .map((indicator) => (
                <div
                  key={indicator.name}
                  className="flex items-start gap-2 rounded-lg border border-border bg-amber-500/5 p-3"
                >
                  <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                  <div className="text-foreground">
                    <span className="font-medium">{indicator.name}:</span> Revisa el estado y toma las acciones
                    necesarias
                  </div>
                </div>
              ))}
            {indicators.every((i) => i.status === 'healthy') && (
              <div className="flex items-start gap-2 rounded-lg border border-border bg-emerald-500/5 p-3">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span className="text-foreground">Todos los sistemas funcionan correctamente</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
