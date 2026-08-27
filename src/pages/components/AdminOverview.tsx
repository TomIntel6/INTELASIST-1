import * as React from 'react'
import { getDefaultApiBase } from '@/lib/supabase'
import { UserManagementService } from '@/lib/user-management'
import { AuditService } from '@/lib/audit-service'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const API_BASE = getDefaultApiBase()
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Users, FileText, Trash2, Activity, TrendingUp, AlertCircle } from 'lucide-react'

/** Paleta de acento semántica por estado (claro + dark). */
type AccentKey = 'sky' | 'emerald' | 'amber' | 'rose' | 'violet'
const ACCENTS: Record<AccentKey, { bar: string; chipBg: string; chipFg: string; ring: string }> = {
  sky: { bar: 'bg-sky-500/70', chipBg: 'bg-sky-500/10', chipFg: 'text-sky-600 dark:text-sky-400', ring: 'ring-sky-500/20' },
  emerald: { bar: 'bg-emerald-500/70', chipBg: 'bg-emerald-500/10', chipFg: 'text-emerald-600 dark:text-emerald-400', ring: 'ring-emerald-500/20' },
  amber: { bar: 'bg-amber-500/70', chipBg: 'bg-amber-500/10', chipFg: 'text-amber-600 dark:text-amber-400', ring: 'ring-amber-500/20' },
  rose: { bar: 'bg-rose-500/70', chipBg: 'bg-rose-500/10', chipFg: 'text-rose-600 dark:text-rose-400', ring: 'ring-rose-500/20' },
  violet: { bar: 'bg-violet-500/70', chipBg: 'bg-violet-500/10', chipFg: 'text-violet-600 dark:text-violet-400', ring: 'ring-violet-500/20' },
}

interface SystemStats {
  totalUsers: number
  activeUsers: number
  suspendedUsers: number
  totalReports: number
  trashCount: number
  recentAuditCount: number
}

export default function AdminOverview() {
  const [stats, setStats] = React.useState<SystemStats | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    try {
      setLoading(true)
      setError(null)

      // Get all stats in one call
      const response = await fetch(`${API_BASE}/api/users/statistics`)
      if (!response.ok) throw new Error('Failed to load statistics')
      const statsData = await response.json()

      const totalUsers = statsData.totalUsers || 0
      const activityStats = {
        activeUsers: statsData.activeUsers,
        suspendedUsers: statsData.suspendedUsers,
        totalReports: statsData.totalReports,
      }

      // Get trash stats
      const trashResponse = await fetch(`${API_BASE}/api/trash/stats`)
      const trashStats = await trashResponse.json()

      const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const auditResponse = await fetch(`${API_BASE}/api/audit-logs?limit=1&startDate=${encodeURIComponent(startDate)}`)
      const auditData = await auditResponse.json()

      setStats({
        totalUsers: totalUsers,
        activeUsers: activityStats.activeUsers,
        suspendedUsers: activityStats.suspendedUsers,
        totalReports: activityStats.totalReports,
        trashCount: trashStats.totalDeleted,
        recentAuditCount: Number(auditData.count || 0),
      })
    } catch (err) {
      console.error('Error loading stats:', err)
      setError(err instanceof Error ? err.message : 'Error cargando estadísticas')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    )
  }

  if (error) {
    return (
      <Card className="border-rose-500/30 bg-rose-500/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
            <span className="flex size-10 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600 ring-1 ring-rose-500/20 dark:text-rose-400" aria-hidden="true">
              <AlertCircle className="size-5" />
            </span>
            Error cargando estadísticas
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">{error}</CardContent>
      </Card>
    )
  }

  if (!stats) {
    return null
  }

  const statCards: Array<{
    title: string
    value: number | string
    icon: React.ComponentType<{ className?: string }>
    accent: AccentKey
    trend: string
  }> = [
    {
      title: 'Usuarios Totales',
      value: stats.totalUsers,
      icon: Users,
      accent: 'sky',
      trend: stats.activeUsers > 0 ? `${stats.activeUsers} activos` : 'Ninguno activo',
    },
    {
      title: 'Informes',
      value: stats.totalReports,
      icon: FileText,
      accent: 'emerald',
      trend: `${(stats.totalReports / Math.max(stats.activeUsers, 1)).toFixed(1)} por usuario`,
    },
    {
      title: 'Usuarios Suspendidos',
      value: stats.suspendedUsers,
      icon: AlertCircle,
      accent: 'amber',
      trend: `${((stats.suspendedUsers / stats.totalUsers) * 100).toFixed(1)}% del total`,
    },
    {
      title: 'Papelera',
      value: stats.trashCount,
      icon: Trash2,
      accent: 'rose',
      trend: 'Elementos pendientes',
    },
    {
      title: 'Auditoría (24h)',
      value: stats.recentAuditCount,
      icon: Activity,
      accent: 'violet',
      trend: 'Acciones registradas',
    },
    {
      title: 'Sistema',
      value: '✓',
      icon: TrendingUp,
      accent: 'emerald',
      trend: 'Funcionando normalmente',
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="mb-1.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            <span className="brand-gradient-bg size-1.5 rounded-full" aria-hidden="true" />
            Administración
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Resumen del Sistema</h1>
          <p className="mt-1 text-sm text-muted-foreground">Estadísticas en tiempo real del panel administrativo</p>
        </div>
        <Button
          variant="outline"
          className="w-full shrink-0 sm:w-auto"
          onClick={() => {
            loadStats()
          }}
        >
          Actualizar
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {statCards.map((card) => {
          const Icon = card.icon
          const a = ACCENTS[card.accent]
          return (
            <Card
              key={card.title}
              className="group relative overflow-hidden rounded-xl border bg-card shadow-sm transition-all hover-lift hover:shadow-md"
            >
              <span className={`absolute inset-x-0 top-0 h-0.5 ${a.bar}`} aria-hidden="true" />
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{card.title}</p>
                    <p className="mt-2 text-3xl font-bold tabular-nums text-foreground">{card.value}</p>
                    <p className="mt-2 text-xs text-muted-foreground">{card.trend}</p>
                  </div>
                  <span
                    className={`flex size-10 shrink-0 items-center justify-center rounded-xl ring-1 transition-transform duration-300 group-hover:scale-105 ${a.chipBg} ${a.chipFg} ${a.ring}`}
                    aria-hidden="true"
                  >
                    <Icon className="size-5" />
                  </span>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Quick Actions */}
      <Card className="rounded-xl border bg-card shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-foreground">Acciones Rápidas</CardTitle>
          <CardDescription>Operaciones comunes de administración</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Button variant="secondary" className="w-full">
              Suspender Inactivos
            </Button>
            <Button variant="secondary" className="w-full">
              Exportar Auditoría
            </Button>
            <Button variant="secondary" className="w-full">
              Vaciar Papelera
            </Button>
            <Button variant="secondary" className="w-full">
              Generar Reporte
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
