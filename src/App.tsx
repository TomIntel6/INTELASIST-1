import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/lib/auth'
import Login from '@/pages/Login'
import AppLayout from '@/components/AppLayout'
import Dashboard from '@/pages/Dashboard'
import ReportsList from '@/pages/ReportsList'
import NewReport from '@/pages/NewReport'
import ReportDetail from '@/pages/ReportDetail'
import AgentControl from '@/pages/AgentControl'
import Usuarios from '@/pages/Usuarios'
import { Spinner } from '@/components/ui/spinner'

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

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="informes" element={<ReportsList />} />
        <Route path="informes/nuevo" element={<NewReport />} />
        <Route path="informes/:id" element={<ReportDetail />} />
        <Route path="control-agentes" element={<AgentControl />} />
        <Route path="usuarios" element={<Usuarios />} />
      </Route>
    </Routes>
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

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginRoute />} />
          <Route path="/*" element={<ProtectedContent />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
