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

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [currentDay, setCurrentDay] = React.useState(new Date())
  const currentYear = currentDay.getFullYear()
  const initialReports = getCachedReportsForYear(currentYear)
  const [_loading, setLoading] = React.useState(initialReports.length === 0)
  const [reports, setReports] = React.useState<Report[]>(initialReports)
  const reportsRef = React.useRef<Report[]>(initialReports)

  React.useEffect(() => {
    let isMounted = true

    const syncReports = async (applyChanges = true) => {
      try {
        if (applyChanges && reportsRef.current.length === 0) {
          setLoading(true)
        }

        const normalizedReports = (await loadAllReports()).filter((report): report is Report => hasValidReportMeta(report))

        if (!isMounted) {
          return
        }

        setReports(normalizedReports)
        reportsRef.current = normalizedReports
      } catch (err) {
        console.error('Error sincronizando reportes:', err)
        if (isMounted) {
          // Usar caché como fallback
          const cachedReports = getCachedReportsForYear(currentYear).filter((report): report is Report => hasValidReportMeta(report))
          setReports(cachedReports)
          reportsRef.current = cachedReports
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    void syncReports(true)

    const intervalId = window.setInterval(() => {
      void syncReports(false)
    }, 30000)

    return () => {
      isMounted = false
      window.clearInterval(intervalId)
    }
  }, [])

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
  const totalFinalized = todayReports.filter(r => isFinalizedStatus(r.status)).length
  const totalPending = todayReports.filter(r => r.status === 'Seguimiento de caso').length
  const totalValidacion = todayReports.filter(r => r.status === 'Validacion').length
  const totalInformativo = todayReports.filter(r => r.status === 'Informativo').length

  return (
    <div className="p-6">
      <div className="floating-surface min-h-[calc(100vh-5rem)] rounded-[2rem] border border-primary/20 bg-card/95 p-6 shadow-[0_34px_110px_-36px_rgba(59,130,246,0.34),0_18px_42px_-24px_rgba(15,23,42,0.3)] backdrop-blur-md md:p-8 dark:border-primary/35 dark:shadow-[0_34px_120px_-36px_rgba(96,165,250,0.42),0_20px_48px_-26px_rgba(15,23,42,0.38)]">
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                Bienvenido, <span className={getNameColorClasses(displayName)}>{displayName.split(' ')[0]}</span>
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Panel de control — Hoy, {currentDay.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {userRoles.map(role => (
                  <Badge key={role} className={`text-[9px] font-semibold ${getRoleColorClasses(role, displayName)}`}>
                    {role}
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
            <Card className="dashboard-soft-surface">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Total Informes</p>
                    <p className="text-3xl font-bold text-foreground mt-1">{totalReports}</p>
                    <p className="text-xs text-muted-foreground mt-2">Total de hoy</p>
                  </div>
                  <div className="size-10 rounded-full bg-muted flex items-center justify-center">
                    <FileText className="size-5 text-muted-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="dashboard-soft-surface">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Finalizados</p>
                    <p className="text-3xl font-bold text-foreground mt-1">{totalFinalized}</p>
                  </div>
                  <div className="size-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                    <CheckCircle2 className="size-5 text-emerald-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="dashboard-soft-surface">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">En Seguimiento</p>
                    <p className="text-3xl font-bold text-foreground mt-1">{totalPending}</p>
                  </div>
                  <div className="size-10 rounded-full bg-amber-500/10 flex items-center justify-center">
                    <Clock className="size-5 text-amber-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="dashboard-soft-surface">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Validacion</p>
                    <p className="text-3xl font-bold text-foreground mt-1">{totalValidacion}</p>
                  </div>
                  <div className="size-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                    <ShieldCheck className="size-5 text-emerald-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="dashboard-soft-surface">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Informativo</p>
                    <p className="text-3xl font-bold text-foreground mt-1">{totalInformativo}</p>
                  </div>
                  <div className="size-10 rounded-full bg-sky-500/10 flex items-center justify-center">
                    <Info className="size-5 text-sky-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
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
                <div className="space-y-2 pt-2">
                  {[
                    { label: 'Finalizados', count: todayReports.filter(r => isFinalizedStatus(r.status)).length, color: 'text-emerald-600' },
                    { label: 'En seguimiento', count: todayReports.filter(r => r.status === 'Seguimiento de caso').length, color: 'text-amber-600' },
                    { label: 'Validacion', count: todayReports.filter(r => r.status === 'Validacion').length, color: 'text-destructive' },
                    { label: 'Informativo', count: todayReports.filter(r => r.status === 'Informativo').length, color: 'text-sky-600' },
                  ].map(({ label, count, color }) => (
                    <div key={label} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{label}</span>
                      <span className={`font-medium ${color}`}>{count}</span>
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
                    <div key={label} className="rounded-lg border border-border/70 p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
                      <p className={`mt-2 text-3xl font-bold ${color}`}>{count}</p>
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
