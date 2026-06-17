import * as React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/lib/auth'
import { PermissionProvider, usePermissions } from '@/lib/permissions-context'
const Login = React.lazy(() => import('@/pages/Login'))
const AppLayout = React.lazy(() => import('@/components/AppLayout'))
const Dashboard = React.lazy(() => import('@/pages/Dashboard'))
const ReportsList = React.lazy(() => import('@/pages/ReportsList'))
const NewReport = React.lazy(() => import('@/pages/NewReport'))
const ReportDetail = React.lazy(() => import('@/pages/ReportDetail'))
const AgentControl = React.lazy(() => import('@/pages/AgentControl'))
const Usuarios = React.lazy(() => import('@/pages/Usuarios'))
const AdminDashboard = React.lazy(() => import('@/pages/AdminDashboard'))
import { Spinner } from '@/components/ui/spinner'
import ErrorBoundary from '@/components/ErrorBoundary'
import { Button } from '@/components/ui/button'

function ProtectedContent() {
  const { user, loading, requiresPasswordChange } = useAuth()

  if (loading) {
    return (
      <div className="min-h-svh flex items-center justify-center">
        <Spinner className="size-6" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (requiresPasswordChange) {
    return <Navigate to="/login" replace />
  }

  const { hasModuleAccess } = usePermissions()
  const canAccessReports = hasModuleAccess('reports')
  const canAccessUsers = hasModuleAccess('users')
  const canAccessAdmin = hasModuleAccess('admin')

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route
          path="informes"
          element={canAccessReports ? <ReportsList /> : <Navigate to="/dashboard" replace />}
        />
        <Route
          path="informes/nuevo"
          element={canAccessReports ? <NewReport /> : <Navigate to="/dashboard" replace />}
        />
        <Route
          path="informes/:id"
          element={canAccessReports ? <ReportDetail /> : <Navigate to="/dashboard" replace />}
        />
        <Route path="control-agentes" element={<AgentControl />} />
        <Route
          path="usuarios"
          element={canAccessUsers ? <Usuarios /> : <Navigate to="/dashboard" replace />}
        />
        <Route
          path="admin/*"
          element={canAccessAdmin ? <AdminDashboard /> : <Navigate to="/dashboard" replace />}
        />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  )
}

function GlobalErrorHandler() {
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)

  React.useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      console.error('Error global capturado:', event.error || event.message)
      setErrorMessage('Ocurrió un error inesperado. Recarga la página para continuar.')
      event.preventDefault()
    }

    const handleRejection = (event: PromiseRejectionEvent) => {
      console.error('Error global en promesa no manejada:', event.reason)
      setErrorMessage('Ocurrió un error en segundo plano. Recarga la página para continuar.')
      event.preventDefault()
    }

    window.addEventListener('error', handleError)
    window.addEventListener('unhandledrejection', handleRejection)

    return () => {
      window.removeEventListener('error', handleError)
      window.removeEventListener('unhandledrejection', handleRejection)
    }
  }, [])

  if (!errorMessage) {
    return null
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-4">
      <div className="max-w-md rounded-3xl border border-border bg-card p-8 text-center shadow-xl">
        <h2 className="text-xl font-bold text-foreground">Error inesperado</h2>
        <p className="mt-3 text-sm text-muted-foreground">{errorMessage}</p>
        <div className="mt-6 flex justify-center">
          <Button onClick={() => window.location.reload()}>Recargar página</Button>
        </div>
      </div>
    </div>
  )
}

function LoginRoute() {
  const { user, loading, requiresPasswordChange } = useAuth()

  if (loading) {
    return (
      <div className="min-h-svh flex items-center justify-center">
        <Spinner className="size-6" />
      </div>
    )
  }

  if (user && !requiresPasswordChange) {
    return <Navigate to="/dashboard" replace />
  }

  return <Login />
}

const pageFallback = (
  <div className="min-h-svh flex items-center justify-center">
    <Spinner className="size-6" />
  </div>
)

export default function App() {
  return (
    <ErrorBoundary>
      <GlobalErrorHandler />
      <BrowserRouter>
        <AuthProvider>
          <PermissionProvider>
            <React.Suspense fallback={pageFallback}>
              <Routes>
                <Route path="/login" element={<LoginRoute />} />
                <Route path="/*" element={<ProtectedContent />} />
              </Routes>
            </React.Suspense>
          </PermissionProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  )
}
