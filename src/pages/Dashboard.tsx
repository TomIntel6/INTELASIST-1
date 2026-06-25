import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { hasValidReportMeta, isFinalizedStatus, type Report, loadAllReports, getCachedReportsForYear } from '@/lib/supabase'
import { getNameColorClasses, getRoleColorClasses, getUserRoles, useAuth } from '@/lib/auth'
import {
  FilePlus,
  FileText,
  CheckCircle2,
  ShieldCheck,
  Clock,
  TrendingUp,
  Info,
} from 'lucide-react'

function isCreatedToday(createdAt: string, referenceDate = new Date()): boolean {
  if (!createdAt) return false

  const createdDate = new Date(createdAt)

  return (
    createdDate.getFullYear() === referenceDate.getFullYear() &&
    createdDate.getMonth() === referenceDate.getMonth() &&
    createdDate.getDate() === referenceDate.getDate()
  )
}

/** Paleta de acento semántica por estado (claro + dark). */
type AccentKey = 'slate' | 'emerald' | 'amber' | 'violet' | 'sky'
const ACCENTS: Record<AccentKey, { bar: string; chipBg: string; chipFg: string; ring: string; text: string }> = {
  slate: { bar: 'bg-slate-400/70', chipBg: 'bg-slate-500/10', chipFg: 'text-slate-600 dark:text-slate-300', ring: 'ring-slate-500/20', text: 'text-slate-600 dark:text-slate-300' },
  emerald: { bar: 'bg-emerald-500/70', chipBg: 'bg-emerald-500/10', chipFg: 'text-emerald-600 dark:text-emerald-400', ring: 'ring-emerald-500/20', text: 'text-emerald-600 dark:text-emerald-400' },
  amber: { bar: 'bg-amber-500/70', chipBg: 'bg-amber-500/10', chipFg: 'text-amber-600 dark:text-amber-400', ring: 'ring-amber-500/20', text: 'text-amber-600 dark:text-amber-400' },
  violet: { bar: 'bg-violet-500/70', chipBg: 'bg-violet-500/10', chipFg: 'text-violet-600 dark:text-violet-400', ring: 'ring-violet-500/20', text: 'text-violet-600 dark:text-violet-400' },
  sky: { bar: 'bg-sky-500/70', chipBg: 'bg-sky-500/10', chipFg: 'text-sky-600 dark:text-sky-400', ring: 'ring-sky-500/20', text: 'text-sky-600 dark:text-sky-400' },
}

function StatCard({
  label,
  value,
  icon: Icon,
  accent,
  sub,
}: {
  label: string
  value: number
  icon: React.ComponentType<{ className?: string }>
  accent: AccentKey
  sub?: string
}) {
  const a = ACCENTS[accent]
  return (
    <Card className="dashboard-soft-surface group relative overflow-hidden transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg">
      <span className={`absolute inset-x-0 top-0 h-0.5 ${a.bar}`} aria-hidden="true" />
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="mt-2 text-3xl font-bold tracking-tight tabular-nums text-foreground">{value}</p>
            {sub ? <p className="mt-2 text-xs text-muted-foreground">{sub}</p> : null}
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
}

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [currentDay, setCurrentDay] = React.useState(new Date())
  const currentYear = currentDay.getFullYear()
  const initialReports = getCachedReportsForYear(currentYear)
  const [_loading, setLoading] = React.useState(initialReports.length === 0)
  const [reports, setReports] = React.useState<Report[]>(initialReports)
  const reportsRef = React.useRef<Report[]>(initialReports)
  const lastSyncRef = React.useRef<number>(0)

  React.useEffect(() => {
    let isMounted = true

    const syncReports = async (force = false) => {
      const now = Date.now()
      const shouldSkip = !force && reportsRef.current.length > 0 && now - lastSyncRef.current < 5 * 60 * 1000
      if (shouldSkip) {
        return
      }

      try {
        if (force || reportsRef.current.length === 0) {
          setLoading(true)
        }

        const normalizedReports = (await loadAllReports()).filter((report): report is Report => hasValidReportMeta(report))

        if (!isMounted) {
          return
        }

        setReports(normalizedReports)
        reportsRef.current = normalizedReports
        lastSyncRef.current = Date.now()
      } catch (err) {
        console.error('Error sincronizando reportes:', err)
        if (isMounted) {
          const cachedReports = getCachedReportsForYear(currentYear).filter((report): report is Report => hasValidReportMeta(report))
          setReports(cachedReports)
          reportsRef.current = cachedReports
          lastSyncRef.current = Date.now()
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    const refreshIfVisible = () => {
      if (document.visibilityState === 'visible') {
        void syncReports(false)
      }
    }

    void syncReports(true)

    window.addEventListener('visibilitychange', refreshIfVisible)
    window.addEventListener('focus', refreshIfVisible)

    return () => {
      isMounted = false
      window.removeEventListener('visibilitychange', refreshIfVisible)
      window.removeEventListener('focus', refreshIfVisible)
    }
  }, [currentYear])

  React.useEffect(() => {
    const ticker = window.setInterval(() => {
      const now = new Date()
      if (now.getDate() !== currentDay.getDate() || now.getMonth() !== currentDay.getMonth() || now.getFullYear() !== currentDay.getFullYear()) {
        setCurrentDay(now)
      }
    }, 60000)

    return () => {
      window.clearInterval(ticker)
    }
  }, [currentDay])

  const displayName = user?.user_metadata?.full_name ?? user?.email ?? 'Usuario'
  const userRoles = getUserRoles(user)

  const todayReports = React.useMemo(
    () => reports.filter(r => hasValidReportMeta(r) && isCreatedToday(r.created_at, currentDay)),
    [reports, currentDay]
  )

  const totalReports = todayReports.length

  const { totalFinalized, totalPending, totalValidacion, totalInformativo } = React.useMemo(() => ({
    totalFinalized: todayReports.filter(r => isFinalizedStatus(r.status)).length,
    totalPending: todayReports.filter(r => r.status === 'Seguimiento de caso').length,
    totalValidacion: todayReports.filter(r => r.status === 'Validacion').length,
    totalInformativo: todayReports.filter(r => r.status === 'Informativo').length,
  }), [todayReports])

  return (
    <div className="p-6">
      <div className="floating-surface relative min-h-[calc(100vh-5rem)] overflow-hidden rounded-[2rem] border border-border/60 bg-card/95 p-6 shadow-[0_30px_90px_-46px_rgba(15,23,42,0.45)] backdrop-blur-md md:p-8">
        <span className="brand-gradient-bg pointer-events-none absolute inset-x-0 top-0 h-1 opacity-80" aria-hidden="true" />
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="mb-1.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                <span className="brand-gradient-bg size-1.5 rounded-full" aria-hidden="true" />
                Panel de control
              </p>
              <h1 className="text-2xl font-bold text-foreground">
                Bienvenido, <span className={getNameColorClasses(displayName)}>{displayName.split(' ')[0]}</span>
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Hoy, {currentDay.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {userRoles.map(role => (
                  <Badge key={role} className={`text-[8px] font-semibold px-1.5 py-0.5 ${getRoleColorClasses(role, displayName)}`}>
                    {role.toUpperCase()}
                  </Badge>
                ))}
                <Badge variant="secondary" className="text-xs">
                  {user?.email ?? 'Usuario'}
                </Badge>
              </div>
            </div>
            <Button
              onClick={() => navigate('/informes/nuevo')}
              className="gap-2 bg-destructive hover:bg-destructive/90 text-white"
            >
              <FilePlus className="size-4" />
              Nuevo Informe
            </Button>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <StatCard label="Total Informes" value={totalReports} icon={FileText} accent="slate" sub="Total de hoy" />
            <StatCard label="Finalizados" value={totalFinalized} icon={CheckCircle2} accent="emerald" />
            <StatCard label="En Seguimiento" value={totalPending} icon={Clock} accent="amber" />
            <StatCard label="Validacion" value={totalValidacion} icon={ShieldCheck} accent="violet" />
            <StatCard label="Informativo" value={totalInformativo} icon={Info} accent="sky" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <Card className="dashboard-soft-surface lg:col-span-1">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="size-4 text-muted-foreground" />
                  Hoy
                </CardTitle>
                <CardDescription>{currentDay.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-4xl font-bold text-foreground">{todayReports.length}</div>
                <p className="text-sm text-muted-foreground">informes registrados hoy</p>
                <div className="space-y-1 pt-2">
                  {[
                    { label: 'Finalizados', count: todayReports.filter(r => isFinalizedStatus(r.status)).length, color: 'text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500' },
                    { label: 'En seguimiento', count: todayReports.filter(r => r.status === 'Seguimiento de caso').length, color: 'text-amber-600 dark:text-amber-400', dot: 'bg-amber-500' },
                    { label: 'Validacion', count: todayReports.filter(r => r.status === 'Validacion').length, color: 'text-violet-600 dark:text-violet-400', dot: 'bg-violet-500' },
                    { label: 'Informativo', count: todayReports.filter(r => r.status === 'Informativo').length, color: 'text-sky-600 dark:text-sky-400', dot: 'bg-sky-500' },
                  ].map(({ label, count, color, dot }) => (
                    <div key={label} className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent">
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <span className={`size-1.5 rounded-full ${dot}`} aria-hidden="true" />
                        {label}
                      </span>
                      <span className={`font-semibold tabular-nums ${color}`}>{count}</span>
                    </div>
                  ))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-2"
                  onClick={() => navigate('/informes')}
                >
                  Ver todos los informes
                </Button>
              </CardContent>
            </Card>

            <Card className="dashboard-soft-surface lg:col-span-3">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="size-4 text-muted-foreground" />
                  Resumen del día
                </CardTitle>
                <CardDescription>{currentDay.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {[
                  { label: 'SOAT', keyword: 'SOAT', color: 'text-sky-600' },
                  { label: 'Saldo Moroso', keyword: 'SALDO MOROSO', color: 'text-red-600' },
                  { label: 'Renovación no pagada', keyword: 'RENOVACION NO PAGADA', color: 'text-orange-600' },
                  { label: 'Servicio utilizado', keyword: 'SERVICIO UTILIZADO', color: 'text-emerald-600' },
                  { label: 'Beneficio en 24h', keyword: 'BENEFICIO EN 24H', color: 'text-purple-600' },
                  { label: 'Póliza cancelada', keyword: 'POLIZA CANCELADA', color: 'text-slate-600' },
                  { label: 'No cubierto por la póliza', keyword: 'NO CUBIERTO POR LA POLIZA', color: 'text-slate-600' },
                  { label: 'Otros', keyword: null, color: 'text-neutral-600' },
                ].map(({ label, keyword, color }) => {
                  const count = keyword
                    ? todayReports.filter(r =>
                        r.observation_comment.toLowerCase().includes(keyword.toLowerCase()) ||
                        r.service_type.toLowerCase().includes(keyword.toLowerCase())
                      ).length
                    : todayReports.filter(r => {
                        const bucketText = `${r.observation_comment} ${r.service_type}`.toUpperCase()
                        return !['SOAT','SALDO MOROSO','RENOVACION NO PAGADA','SERVICIO UTILIZADO','BENEFICIO EN 24H','POLIZA CANCELADA','NO CUBIERTO POR LA POLIZA'].some(keyword => bucketText.includes(keyword))
                      }).length

                  return (
                    <div
                      key={label}
                      className="group rounded-xl border border-border/60 bg-card/50 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-border hover:bg-accent hover:shadow-sm"
                    >
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
                      <p className={`mt-2 text-3xl font-bold tabular-nums ${color}`}>{count}</p>
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
