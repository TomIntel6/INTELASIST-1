import * as React from 'react'
import { useAuth } from '@/lib/auth'
import { usePermissions } from '@/lib/permissions-context'
import { PERMISSIONS } from '@/lib/permissions'
import { useRealtimeAuditLogs } from '@/hooks/useRealtime'
import { useNotifications } from '@/hooks/useRealtime'
import { Navigate } from 'react-router-dom'
import ErrorBoundary from '@/components/ErrorBoundary'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { NotificationCenter } from '@/components/NotificationCenter'
import { Settings, BarChart3, Trash2, Users as UsersIcon, Activity, Zap, Lock, FileText, UserPlus } from 'lucide-react'

const AdminOverview = React.lazy(() => import('./components/AdminOverview'))
const PermissionsManagement = React.lazy(() => import('./components/PermissionsManagement'))
const PermissionModules = React.lazy(() => import('./components/PermissionModules'))
const AuditLog = React.lazy(() => import('./components/AuditLog'))
const AuditReports = React.lazy(() => import('./components/AuditReports'))
const ActivityTimeline = React.lazy(() => import('./components/ActivityTimeline'))
const TrashBin = React.lazy(() => import('./components/TrashBin'))
const AdvancedUserManagement = React.lazy(() => import('./components/AdvancedUserManagement'))
const AgentControl = React.lazy(() => import('@/pages/AgentControl'))
const SystemHealth = React.lazy(() => import('./components/SystemHealth'))

// Fallback component for lazy-loaded content
const LoadingFallback = () => (
  <Card>
    <CardHeader>
      <CardTitle>Cargando...</CardTitle>
    </CardHeader>
  </Card>
)

// Memoized tab content wrapper
interface TabContentProps {
  children: React.ReactNode
}

const MemoizedTabContent = React.memo(function MemoizedTabContent({ children }: TabContentProps) {
  return <div className="space-y-4">{children}</div>
})

export default function AdminDashboard() {
  const { user } = useAuth()
  const { hasPermission } = usePermissions()
  const { notifications, removeNotification } = useNotifications(user?.id || '')

  // Subscribe to real-time audit logs
  const handleAuditUpdate = React.useCallback((event: any) => {
    console.log('📊 Real-time audit update:', event)
  }, [])

  useRealtimeAuditLogs(handleAuditUpdate)

  if (!hasPermission(PERMISSIONS.SYSTEM.MANAGE_PERMISSIONS)) {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Settings className="" />
            <h1 className="text-4xl font-bold text-slate-900">Configuracion</h1>
          </div>
          <p className="text-slate-600">Panel de control completo del sistema con todas las herramientas de administración</p>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-3 lg:grid-cols-10 mb-6 h-auto flex-wrap gap-2">
            <TabsTrigger value="overview" className="flex items-center gap-2 text-xs sm:text-sm">
              <Zap className="size-4" />
              <span className="hidden sm:inline">Resumen</span>
            </TabsTrigger>
            <TabsTrigger value="permissions" className="flex items-center gap-2 text-xs sm:text-sm">
              <Lock className="size-4" />
              <span className="hidden sm:inline">Permisos</span>
            </TabsTrigger>
            <TabsTrigger value="modules" className="flex items-center gap-2 text-xs sm:text-sm">
              <Settings className="size-4" />
              <span className="hidden sm:inline">Módulos</span>
            </TabsTrigger>
            <TabsTrigger value="agents" className="flex items-center gap-2 text-xs sm:text-sm">
              <UserPlus className="size-4" />
              <span className="hidden sm:inline">Agentes</span>
            </TabsTrigger>
            <TabsTrigger value="audit" className="flex items-center gap-2 text-xs sm:text-sm">
              <BarChart3 className="size-4" />
              <span className="hidden sm:inline">Auditoría</span>
            </TabsTrigger>
            <TabsTrigger value="reports" className="flex items-center gap-2 text-xs sm:text-sm">
              <FileText className="size-4" />
              <span className="hidden sm:inline">Reportes</span>
            </TabsTrigger>
            <TabsTrigger value="activity" className="flex items-center gap-2 text-xs sm:text-sm">
              <Activity className="size-4" />
              <span className="hidden sm:inline">Timeline</span>
            </TabsTrigger>
            <TabsTrigger value="trash" className="flex items-center gap-2 text-xs sm:text-sm">
              <Trash2 className="size-4" />
              <span className="hidden sm:inline">Papelera</span>
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center gap-2 text-xs sm:text-sm">
              <UsersIcon className="size-4" />
              <span className="hidden sm:inline">Usuarios</span>
            </TabsTrigger>
            <TabsTrigger value="health" className="flex items-center gap-2 text-xs sm:text-sm">
              <Activity className="size-4" />
              <span className="hidden sm:inline">Salud</span>
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview">
            <React.Suspense fallback={<LoadingFallback />}>
              <AdminOverview />
            </React.Suspense>
          </TabsContent>

          {/* Permissions Tab */}
          <TabsContent value="permissions">
            <React.Suspense fallback={<LoadingFallback />}>
              <PermissionsManagement />
            </React.Suspense>
          </TabsContent>

          {/* Modules Tab */}
          <TabsContent value="modules">
            <React.Suspense fallback={<LoadingFallback />}>
              <PermissionModules />
            </React.Suspense>
          </TabsContent>

          {/* Agents Tab */}
          <TabsContent value="agents">
            <React.Suspense fallback={<LoadingFallback />}>
              <AgentControl />
            </React.Suspense>
          </TabsContent>

          {/* Audit Tab */}
          <TabsContent value="audit">
            <React.Suspense fallback={<LoadingFallback />}>
              <ErrorBoundary>
                <AuditLog />
              </ErrorBoundary>
            </React.Suspense>
          </TabsContent>

          {/* Reports Tab */}
          <TabsContent value="reports">
            <React.Suspense fallback={<LoadingFallback />}>
              <ErrorBoundary>
                <AuditReports />
              </ErrorBoundary>
            </React.Suspense>
          </TabsContent>

          {/* Activity Tab */}
          <TabsContent value="activity">
            <React.Suspense fallback={<LoadingFallback />}>
              <ActivityTimeline />
            </React.Suspense>
          </TabsContent>

          {/* Trash Tab */}
          <TabsContent value="trash">
            <React.Suspense fallback={<LoadingFallback />}>
              <TrashBin />
            </React.Suspense>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users">
            <React.Suspense fallback={<LoadingFallback />}>
              <AdvancedUserManagement />
            </React.Suspense>
          </TabsContent>

          {/* Health Tab */}
          <TabsContent value="health">
            <React.Suspense fallback={<LoadingFallback />}>
              <SystemHealth />
            </React.Suspense>
          </TabsContent>
        </Tabs>
      </div>

      {/* Real-time Notification Center */}
      <NotificationCenter notifications={notifications} onDismiss={removeNotification} />
    </div>
  )
}
