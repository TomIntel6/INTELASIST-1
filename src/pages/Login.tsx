import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { useAuth } from '@/lib/auth'

export default function Login() {
  const navigate = useNavigate()
  const { signInWithEmailPassword, user, requiresPasswordChange, updatePassword } = useAuth()
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [newPassword, setNewPassword] = React.useState('')
  const [confirmPassword, setConfirmPassword] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [updatingPassword, setUpdatingPassword] = React.useState(false)
  const [error, setError] = React.useState('')

  const needsPasswordChange = requiresPasswordChange || user?.user_metadata?.must_change_password === true

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setError('')

    try {
      await signInWithEmailPassword(email.trim(), password)
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'No se pudo iniciar sesión. Verifica tus credenciales.'
      )
    } finally {
      setLoading(false)
    }
  }

  const handlePasswordUpdate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setUpdatingPassword(true)
    setError('')

    if (!newPassword || !confirmPassword) {
      setError('Completa la nueva contraseña y su confirmación.')
      setUpdatingPassword(false)
      return
    }

    if (newPassword.length < 6) {
      setError('La nueva contraseña debe tener al menos 6 caracteres.')
      setUpdatingPassword(false)
      return
    }

    if (newPassword !== confirmPassword) {
      setError('La confirmación no coincide con la nueva contraseña.')
      setUpdatingPassword(false)
      return
    }

    try {
      await updatePassword(newPassword)
      navigate('/dashboard', { replace: true })
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : 'No se pudo actualizar la contraseña. Intenta nuevamente.'
      )
    } finally {
      setUpdatingPassword(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="absolute inset-0 overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950">
        <div className="absolute left-1/2 top-4 h-72 w-72 -translate-x-1/2 rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="absolute right-10 top-24 h-56 w-56 rounded-full bg-violet-500/15 blur-3xl" />
        <div className="absolute left-10 bottom-10 h-64 w-64 rounded-full bg-slate-200/10 blur-3xl" />
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.12),transparent_20%),radial-gradient(circle_at_bottom_right,rgba(139,92,246,0.1),transparent_25%)]" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
        <div className="w-full max-w-md rounded-[2rem] bg-slate-950/95 p-8 shadow-[0_20px_80px_-30px_rgba(0,0,0,0.6)] ring-1 ring-white/10">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-slate-900/80 ring-1 ring-cyan-500/20 shadow-sm">
              <img
                src="/intelasist.png"
                alt="Logo INTELASIST"
                className="h-14 w-14 object-contain"
              />
            </div>
            <p className="text-sm uppercase tracking-[0.25em] text-cyan-300">INTELASIST</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">Iniciar sesión</h1>
            <p className="mt-2 text-sm leading-6 text-slate-400">Accede a tu panel con credenciales seguras.</p>
          </div>

          {needsPasswordChange ? (
            <form onSubmit={handlePasswordUpdate} className="space-y-5">
              <div className="space-y-3">
                <Label htmlFor="new-password" className="text-slate-300">Nueva contraseña</Label>
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Nueva contraseña"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  className="border-slate-700 bg-slate-900 text-slate-100 placeholder:text-slate-500 focus-visible:border-cyan-400 focus-visible:ring-cyan-500/20"
                  required
                />
              </div>

              <div className="space-y-3">
                <Label htmlFor="confirm-password" className="text-slate-300">Confirmar contraseña</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Repite la nueva contraseña"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="border-slate-700 bg-slate-900 text-slate-100 placeholder:text-slate-500 focus-visible:border-cyan-400 focus-visible:ring-cyan-500/20"
                  required
                />
              </div>

              {error ? <p className="rounded-2xl bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</p> : null}

              <Button type="submit" disabled={updatingPassword} size="lg" className="w-full bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:bg-cyan-400">
                {updatingPassword ? <Spinner className="size-4" /> : 'Guardar contraseña'}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-3">
                <Label htmlFor="email" className="text-slate-300">Correo electrónico</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="correo@empresa.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="border-slate-700 bg-slate-900 text-slate-100 placeholder:text-slate-500 focus-visible:border-cyan-400 focus-visible:ring-cyan-500/20"
                  required
                />
              </div>

              <div className="space-y-3">
                <Label htmlFor="password" className="text-slate-300">Contraseña</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="border-slate-700 bg-slate-900 text-slate-100 placeholder:text-slate-500 focus-visible:border-cyan-400 focus-visible:ring-cyan-500/20"
                  required
                />
              </div>

              {error ? <p className="rounded-2xl bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</p> : null}

              <Button type="submit" disabled={loading} size="lg" className="w-full bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/20 transition duration-300 ease-out hover:bg-cyan-400 hover:-translate-y-0.5 active:translate-y-0">
                {loading ? <Spinner className="size-4" /> : 'Entrar'}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
