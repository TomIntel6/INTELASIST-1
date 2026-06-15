import * as React from 'react'
import { useAuth } from '@/lib/auth'
import { usePermissions } from '@/lib/permissions-context'
import { useRealtimeAuditLogs } from '@/hooks/useRealtime'
import { useNotifications } from '@/hooks/useRealtime'
import { Navigate } from 'react-router-dom'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { NotificationCenter } from '@/components/NotificationCenter'
import { Settings, BarChart3, Trash2, Users as UsersIcon, Activity, Zap, Lock, FileText } from 'lucide-react'

const AdminOverview = React.lazy(() => import('./components/AdminOverview'))
const PermissionsManagement = React.lazy(() => import('./components/PermissionsManagement'))
const PermissionModules = React.lazy(() => import('./components/PermissionModules'))
const AuditLog = React.lazy(() => import('./components/AuditLog'))
const AuditReports = React.lazy(() => import('./components/AuditReports'))
const ActivityTimeline = React.lazy(() => import('./components/ActivityTimeline'))
const TrashBin = React.lazy(() => import('./components/TrashBin'))
const AdvancedUserManagement = React.lazy(() => import('./components/AdvancedUserManagement'))
const SystemHealth = React.lazy(() => import('./components/SystemHealth'))

export default function AdminDashboard() {
  const { user } = useAuth()
  const { isSupport } = usePermissions()
  const { notifications, removeNotification } = useNotifications(user?.id || '')

  // Subscribe to real-time audit logs
  const handleAuditUpdate = React.useCallback((event: any) => {
    console.log('📊 Real-time audit update:', event)
    // The components will handle re-fetching data if needed
  }, [])

  useRealtimeAuditLogs(handleAuditUpdate)

  // Solo Support puede acceder
  if (!isSupport) {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Settings className="size-8 text-purple-600" />
            <h1 className="text-4xl font-bold text-slate-900">Administración Avanzada</h1>
          </div>
          <p className="text-slate-600">Panel de control completo del sistema con todas las herramientas de administración</p>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-3 lg:grid-cols-9 mb-6 h-auto flex-wrap gap-2">
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
          <TabsContent value="overview" className="space-y-4">
            <React.Suspense
              fallback={
                <Card>
                  <CardHeader>
                    <CardTitle>Cargando...</CardTitle>
                  </CardHeader>
                </Card>
              }
            >
              <AdminOverview />
            </React.Suspense>
          </TabsContent>

          {/* Permissions Tab */}
          <TabsContent value="permissions" className="space-y-4">
            <React.Suspense
              fallback={
                <Card>
                  <CardHeader>
                    <CardTitle>Cargando...</CardTitle>
                  </CardHeader>
                </Card>
              }
            >
              <PermissionsManagement />
            </React.Suspense>
          </TabsContent>

          {/* Modules Tab */}
          <TabsContent value="modules" className="space-y-4">
            <React.Suspense
              fallback={
                <Card>
                  <CardHeader>
                    <CardTitle>Cargando...</CardTitle>
                  </CardHeader>
                </Card>
              }
            >
              <PermissionModules />
            </React.Suspense>
          </TabsContent>

          {/* Audit Tab */}
          <TabsContent value="audit" className="space-y-4">
            <React.Suspense
              fallback={
                <Card>
                  <CardHeader>
                    <CardTitle>Cargando...</CardTitle>
                  </CardHeader>
                </Card>
              }
            >
              <AuditLog />
            </React.Suspense>
          </TabsContent>

          {/* Reports Tab */}
          <TabsContent value="reports" className="space-y-4">
            <React.Suspense
              fallback={
                <Card>
                  <CardHeader>
                    <CardTitle>Cargando...</CardTitle>
                  </CardHeader>
                </Card>
              }
            >
              <AuditReports />
            </React.Suspense>
          </TabsContent>

          {/* Activity Tab */}
          <TabsContent value="activity" className="space-y-4">
            <React.Suspense
              fallback={
                <Card>
                  <CardHeader>
                    <CardTitle>Cargando...</CardTitle>
                  </CardHeader>
                </Card>
              }
            >
              <ActivityTimeline />
            </React.Suspense>
          </TabsContent>

          {/* Trash Tab */}
          <TabsContent value="trash" className="space-y-4">
            <React.Suspense
              fallback={
                <Card>
                  <CardHeader>
                    <CardTitle>Cargando...</CardTitle>
                  </CardHeader>
                </Card>
              }
            >
              <TrashBin />
            </React.Suspense>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-4">
            <React.Suspense
              fallback={
                <Card>
                  <CardHeader>
                    <CardTitle>Cargando...</CardTitle>
                  </CardHeader>
                </Card>
              }
            >
              <AdvancedUserManagement />
            </React.Suspense>
          </TabsContent>

          {/* Health Tab */}
          <TabsContent value="health" className="space-y-4">
            <React.Suspense
              fallback={
                <Card>
                  <CardHeader>
                    <CardTitle>Cargando...</CardTitle>
                  </CardHeader>
                </Card>
              }
            >
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
