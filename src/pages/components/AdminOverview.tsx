import * as React from 'react'
import { getDefaultApiBase } from '@/lib/supabase'
import { UserManagementService } from '@/lib/user-management'
import { AuditService } from '@/lib/audit-service'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const API_BASE = getDefaultApiBase()
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { Users, FileText, Trash2, Activity, TrendingUp, AlertCircle } from 'lucide-react'

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
      <Card className="border-red-200 bg-red-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-900">
            <AlertCircle className="size-5" />
            Error cargando estadísticas
          </CardTitle>
        </CardHeader>
        <CardContent className="text-red-800">{error}</CardContent>
      </Card>
    )
  }

  if (!stats) {
    return null
  }

  const statCards = [
    {
      title: 'Usuarios Totales',
      value: stats.totalUsers,
      icon: Users,
      color: 'bg-blue-500/10 text-blue-700 border-blue-200',
      trend: stats.activeUsers > 0 ? `${stats.activeUsers} activos` : 'Ninguno activo',
    },
    {
      title: 'Informes',
      value: stats.totalReports,
      icon: FileText,
      color: 'bg-emerald-500/10 text-emerald-700 border-emerald-200',
      trend: `${(stats.totalReports / Math.max(stats.activeUsers, 1)).toFixed(1)} por usuario`,
    },
    {
      title: 'Usuarios Suspendidos',
      value: stats.suspendedUsers,
      icon: AlertCircle,
      color: 'bg-amber-500/10 text-amber-700 border-amber-200',
      trend: `${((stats.suspendedUsers / stats.totalUsers) * 100).toFixed(1)}% del total`,
    },
    {
      title: 'Papelera',
      value: stats.trashCount,
      icon: Trash2,
      color: 'bg-red-500/10 text-red-700 border-red-200',
      trend: 'Elementos pendientes',
    },
    {
      title: 'Auditoría (24h)',
      value: stats.recentAuditCount,
      icon: Activity,
      color: 'bg-purple-500/10 text-purple-700 border-purple-200',
      trend: 'Acciones registradas',
    },
    {
      title: 'Sistema',
      value: '✓',
      icon: TrendingUp,
      color: 'bg-green-500/10 text-green-700 border-green-200',
      trend: 'Funcionando normalmente',
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Resumen del Sistema</h2>
          <p className="text-sm text-slate-600">Estadísticas en tiempo real del panel administrativo</p>
        </div>
        <button
          onClick={() => {
            loadStats()
          }}
          className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
        >
          Actualizar
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon
          return (
            <Card key={card.title} className={`border ${card.color}`}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
                  <Icon className="size-5 opacity-60" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="text-3xl font-bold">{card.value}</div>
                  <p className="text-xs opacity-70">{card.trend}</p>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Acciones Rápidas</CardTitle>
          <CardDescription>Operaciones comunes de administración</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <button className="px-3 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">
              Suspender Inactivos
            </button>
            <button className="px-3 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">
              Exportar Auditoría
            </button>
            <button className="px-3 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">
              Vaciar Papelera
            </button>
            <button className="px-3 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">
              Generar Reporte
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
