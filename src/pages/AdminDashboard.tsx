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
import { cn } from '@/lib/utils'

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

// Estilo compartido de pestañas: estado activo con acento de marca
const adminTabTriggerClass = cn(
  'flex min-h-11 items-center gap-2 rounded-md border border-transparent px-3 py-2 text-xs font-medium text-muted-foreground transition-all duration-300 ease-out sm:text-sm',
  'hover:bg-accent/70 hover:text-foreground',
  'data-[state=active]:min-h-16 data-[state=active]:scale-[1.02] data-[state=active]:border-border/70 data-[state=active]:border-r-2 data-[state=active]:border-r-primary data-[state=active]:bg-accent/80 data-[state=active]:font-semibold data-[state=active]:text-foreground data-[state=active]:shadow-sm',
  'data-[state=active]:[&>svg]:size-[1.1rem] data-[state=active]:[&>svg]:text-[var(--brand-2)]'
)

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
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="glass-panel relative mb-8 overflow-hidden rounded-2xl p-6">
          <span className="brand-gradient-bg pointer-events-none absolute inset-x-0 top-0 h-1 opacity-80" aria-hidden="true" />
          <div className="flex items-center gap-4">
            <span className="brand-monogram flex size-12 shrink-0 items-center justify-center rounded-xl" aria-hidden="true">
              <Settings className="size-6" />
            </span>
            <div>
              <p className="mb-1.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                <span className="brand-gradient-bg size-1.5 rounded-full" aria-hidden="true" />
                Administración
              </p>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Configuracion</h1>
              <p className="mt-1 text-sm text-muted-foreground">Panel de control completo del sistema con todas las herramientas de administración</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="overview" orientation="vertical" className="w-full flex-col lg:flex-row lg:items-start">
          <TabsList aria-label="Navegación de Gestión de Permisos" className="order-2 grid w-full min-w-0 grid-cols-2 gap-1 border-t border-border/70 bg-transparent p-2 lg:sticky lg:top-6 lg:order-2 lg:max-h-[calc(100vh-3rem)] lg:w-60 lg:shrink-0 lg:grid-cols-1 lg:gap-1 lg:border-l lg:border-t-0 lg:p-3">
            <TabsTrigger value="overview" className={adminTabTriggerClass}>
              <Zap className="size-4" />
              <span className="hidden sm:inline">Resumen</span>
            </TabsTrigger>
            <TabsTrigger value="permissions" className={adminTabTriggerClass}>
              <Lock className="size-4" />
              <span className="hidden sm:inline">Permisos</span>
            </TabsTrigger>
            <TabsTrigger value="modules" className={adminTabTriggerClass}>
              <Settings className="size-4" />
              <span className="hidden sm:inline">Módulos</span>
            </TabsTrigger>
            <TabsTrigger value="agents" className={adminTabTriggerClass}>
              <UserPlus className="size-4" />
              <span className="hidden sm:inline">Agentes</span>
            </TabsTrigger>
            <TabsTrigger value="audit" className={adminTabTriggerClass}>
              <BarChart3 className="size-4" />
              <span className="hidden sm:inline">Auditoría</span>
            </TabsTrigger>
            <TabsTrigger value="reports" className={adminTabTriggerClass}>
              <FileText className="size-4" />
              <span className="hidden sm:inline">Reportes</span>
            </TabsTrigger>
            <TabsTrigger value="activity" className={adminTabTriggerClass}>
              <Activity className="size-4" />
              <span className="hidden sm:inline">Timeline</span>
            </TabsTrigger>
            <TabsTrigger value="trash" className={adminTabTriggerClass}>
              <Trash2 className="size-4" />
              <span className="hidden sm:inline">Papelera</span>
            </TabsTrigger>
            <TabsTrigger value="users" className={adminTabTriggerClass}>
              <UsersIcon className="size-4" />
              <span className="hidden sm:inline">Usuarios</span>
            </TabsTrigger>
            <TabsTrigger value="health" className={adminTabTriggerClass}>
              <Activity className="size-4" />
              <span className="hidden sm:inline">Salud</span>
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="order-1 min-w-0 w-full transition-[opacity,transform] duration-300 data-[state=active]:translate-y-0 data-[state=active]:opacity-100 data-[state=inactive]:translate-y-1 data-[state=inactive]:opacity-0 lg:order-1">
            <React.Suspense fallback={<LoadingFallback />}>
              <AdminOverview />
            </React.Suspense>
          </TabsContent>

          {/* Permissions Tab */}
          <TabsContent value="permissions" className="order-1 min-w-0 w-full transition-[opacity,transform] duration-300 data-[state=active]:translate-y-0 data-[state=active]:opacity-100 data-[state=inactive]:translate-y-1 data-[state=inactive]:opacity-0 lg:order-1">
            <React.Suspense fallback={<LoadingFallback />}>
              <PermissionsManagement />
            </React.Suspense>
          </TabsContent>

          {/* Modules Tab */}
          <TabsContent value="modules" className="order-1 min-w-0 w-full transition-[opacity,transform] duration-300 data-[state=active]:translate-y-0 data-[state=active]:opacity-100 data-[state=inactive]:translate-y-1 data-[state=inactive]:opacity-0 lg:order-1">
            <React.Suspense fallback={<LoadingFallback />}>
              <PermissionModules />
            </React.Suspense>
          </TabsContent>

          {/* Agents Tab */}
          <TabsContent value="agents" className="order-1 min-w-0 w-full transition-[opacity,transform] duration-300 data-[state=active]:translate-y-0 data-[state=active]:opacity-100 data-[state=inactive]:translate-y-1 data-[state=inactive]:opacity-0 lg:order-1">
            <React.Suspense fallback={<LoadingFallback />}>
              <AgentControl />
            </React.Suspense>
          </TabsContent>

          {/* Audit Tab */}
          <TabsContent value="audit" className="order-1 min-w-0 w-full transition-[opacity,transform] duration-300 data-[state=active]:translate-y-0 data-[state=active]:opacity-100 data-[state=inactive]:translate-y-1 data-[state=inactive]:opacity-0 lg:order-1">
            <React.Suspense fallback={<LoadingFallback />}>
              <ErrorBoundary>
                <AuditLog />
              </ErrorBoundary>
            </React.Suspense>
          </TabsContent>

          {/* Reports Tab */}
          <TabsContent value="reports" className="order-1 min-w-0 w-full transition-[opacity,transform] duration-300 data-[state=active]:translate-y-0 data-[state=active]:opacity-100 data-[state=inactive]:translate-y-1 data-[state=inactive]:opacity-0 lg:order-1">
            <React.Suspense fallback={<LoadingFallback />}>
              <ErrorBoundary>
                <AuditReports />
              </ErrorBoundary>
            </React.Suspense>
          </TabsContent>

          {/* Activity Tab */}
          <TabsContent value="activity" className="order-1 min-w-0 w-full transition-[opacity,transform] duration-300 data-[state=active]:translate-y-0 data-[state=active]:opacity-100 data-[state=inactive]:translate-y-1 data-[state=inactive]:opacity-0 lg:order-1">
            <React.Suspense fallback={<LoadingFallback />}>
              <ActivityTimeline />
            </React.Suspense>
          </TabsContent>

          {/* Trash Tab */}
          <TabsContent value="trash" className="order-1 min-w-0 w-full transition-[opacity,transform] duration-300 data-[state=active]:translate-y-0 data-[state=active]:opacity-100 data-[state=inactive]:translate-y-1 data-[state=inactive]:opacity-0 lg:order-1">
            <React.Suspense fallback={<LoadingFallback />}>
              <TrashBin />
            </React.Suspense>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users" className="order-1 min-w-0 w-full transition-[opacity,transform] duration-300 data-[state=active]:translate-y-0 data-[state=active]:opacity-100 data-[state=inactive]:translate-y-1 data-[state=inactive]:opacity-0 lg:order-1">
            <React.Suspense fallback={<LoadingFallback />}>
              <AdvancedUserManagement />
            </React.Suspense>
          </TabsContent>

          {/* Health Tab */}
          <TabsContent value="health" className="order-1 min-w-0 w-full transition-[opacity,transform] duration-300 data-[state=active]:translate-y-0 data-[state=active]:opacity-100 data-[state=inactive]:translate-y-1 data-[state=inactive]:opacity-0 lg:order-1">
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
