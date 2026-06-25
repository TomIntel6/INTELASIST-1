import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { useAuth } from '@/lib/auth'
import {
  AlertCircle,
  BellRing,
  Eye,
  EyeOff,
  FileText,
  Lock,
  Mail,
  ScrollText,
  ShieldCheck,
} from 'lucide-react'

const FEATURES = [
  {
    icon: FileText,
    title: 'Informes e incidentes',
    desc: 'Registra y da seguimiento a cada caso.',
  },
  {
    icon: ShieldCheck,
    title: 'Evidencias seguras',
    desc: 'Adjunta y resguarda la documentación.',
  },
  {
    icon: BellRing,
    title: 'Alertas en tiempo real',
    desc: 'Detecta y notifica lo que importa.',
  },
  {
    icon: ScrollText,
    title: 'Auditoría y trazabilidad',
    desc: 'Cada acción queda registrada.',
  },
]

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
  const [showPassword, setShowPassword] = React.useState(false)
  const [showNewPassword, setShowNewPassword] = React.useState(false)

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

  const inputClass =
    'h-11 border-slate-700 bg-slate-900/80 pl-10 text-slate-100 placeholder:text-slate-500 focus-visible:border-cyan-400 focus-visible:ring-cyan-500/20'

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      {/* Fondo decorativo */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950">
        <div className="absolute left-1/4 top-0 h-72 w-72 -translate-x-1/2 rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="absolute right-10 top-24 h-56 w-56 rounded-full bg-violet-500/15 blur-3xl" />
        <div className="absolute bottom-10 left-10 h-64 w-64 rounded-full bg-slate-200/10 blur-3xl" />
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.12),transparent_20%),radial-gradient(circle_at_bottom_right,rgba(139,92,246,0.1),transparent_25%)]" />
      </div>

      <div className="relative mx-auto grid min-h-screen w-full max-w-6xl grid-cols-1 items-center gap-10 px-4 py-12 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-8">
        {/* ── Panel de marca (solo desktop) ── */}
        <section className="hidden flex-col justify-between lg:flex">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-slate-900/80 ring-1 ring-cyan-500/20">
                <img src="/intelasist.png" alt="Logo INTELASIST" className="size-8 object-contain" />
              </div>
              <span className="text-sm font-semibold uppercase tracking-[0.25em] text-cyan-300">
                INTELASIST
              </span>
            </div>

            <h2 className="mt-10 max-w-md text-4xl font-semibold leading-tight tracking-tight text-white">
              Informes, evidencias y alertas en un solo lugar.
            </h2>
            <p className="mt-4 max-w-md text-base leading-7 text-slate-400">
              Gestiona casos, resguarda la evidencia y mantén la trazabilidad total de cada acción
              de tu equipo.
            </p>

            <ul className="mt-10 space-y-5">
              {FEATURES.map((feature) => (
                <li key={feature.title} className="flex items-start gap-3">
                  <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/5 text-cyan-300 ring-1 ring-white/10">
                    <feature.icon className="size-5" />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-white">{feature.title}</p>
                    <p className="text-xs text-slate-400">{feature.desc}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <p className="mt-12 flex items-center gap-2 text-xs text-slate-500">
            <Lock className="size-3.5" />
            Conexión segura · Acceso solo para personal autorizado
          </p>
        </section>

        {/* ── Tarjeta de acceso ── */}
        <div className="mx-auto w-full max-w-md">
          <div className="rounded-[2rem] bg-slate-950/95 p-8 shadow-[0_20px_80px_-30px_rgba(0,0,0,0.6)] ring-1 ring-white/10 backdrop-blur-sm sm:p-10">
            {/* Cabecera compacta (visible siempre, refuerza marca en móvil) */}
            <div className="mb-8 text-center">
              <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-slate-900/80 shadow-sm ring-1 ring-cyan-500/20 lg:hidden">
                <img src="/intelasist.png" alt="Logo INTELASIST" className="h-14 w-14 object-contain" />
              </div>
              <p className="text-sm uppercase tracking-[0.25em] text-cyan-300 lg:hidden">INTELASIST</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white lg:mt-0">
                {needsPasswordChange ? 'Crea tu contraseña' : 'Iniciar sesión'}
              </h1>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                {needsPasswordChange
                  ? 'Define una nueva contraseña para continuar.'
                  : 'Accede a tu panel con credenciales seguras.'}
              </p>
            </div>

            {needsPasswordChange ? (
              <form onSubmit={handlePasswordUpdate} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="new-password" className="text-slate-300">
                    Nueva contraseña
                  </Label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
                    <Input
                      id="new-password"
                      type={showNewPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      placeholder="Nueva contraseña"
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                      className={`${inputClass} pr-10`}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword((v) => !v)}
                      aria-label={showNewPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 transition-colors hover:text-slate-300"
                    >
                      {showNewPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm-password" className="text-slate-300">
                    Confirmar contraseña
                  </Label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
                    <Input
                      id="confirm-password"
                      type={showNewPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      placeholder="Repite la nueva contraseña"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      className={inputClass}
                      required
                    />
                  </div>
                </div>

                {error ? (
                  <p
                    role="alert"
                    className="flex items-center gap-2 rounded-2xl bg-rose-500/10 px-4 py-3 text-sm text-rose-200 ring-1 ring-rose-500/20"
                  >
                    <AlertCircle className="size-4 shrink-0" />
                    {error}
                  </p>
                ) : null}

                <Button
                  type="submit"
                  disabled={updatingPassword}
                  size="lg"
                  className="w-full bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/20 transition duration-300 ease-out hover:-translate-y-0.5 hover:bg-cyan-400 active:translate-y-0"
                >
                  {updatingPassword ? <Spinner className="size-4" /> : 'Guardar contraseña'}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleLogin} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-slate-300">
                    Correo electrónico
                  </Label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      placeholder="correo@empresa.com"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      className={inputClass}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-slate-300">
                    Contraseña
                  </Label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className={`${inputClass} pr-10`}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 transition-colors hover:text-slate-300"
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>

                {error ? (
                  <p
                    role="alert"
                    className="flex items-center gap-2 rounded-2xl bg-rose-500/10 px-4 py-3 text-sm text-rose-200 ring-1 ring-rose-500/20"
                  >
                    <AlertCircle className="size-4 shrink-0" />
                    {error}
                  </p>
                ) : null}

                <Button
                  type="submit"
                  disabled={loading}
                  size="lg"
                  className="w-full bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/20 transition duration-300 ease-out hover:-translate-y-0.5 hover:bg-cyan-400 active:translate-y-0"
                >
                  {loading ? <Spinner className="size-4" /> : 'Entrar'}
                </Button>
              </form>
            )}

            <p className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-500 lg:hidden">
              <Lock className="size-3.5" />
              Conexión segura
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
