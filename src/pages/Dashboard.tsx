import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { hasValidReportMeta, isFinalizedStatus, type Report, type DashboardStats, fetchDashboardStats, loadReportsForMonth, MONTHS, normalizeReportRecord } from '@/lib/supabase'
import { useRealtimeReports } from '@/hooks/useRealtime'
import type { RealtimeEvent } from '@/lib/realtime-service'
import { getNameColorClasses, getRoleColorClasses, getUserRoles, useAuth } from '@/lib/auth'
import { usePermissions } from '@/lib/permissions-context'
import { PERMISSIONS } from '@/lib/permissions'
import {
  FilePlus,
  FileText,
  CheckCircle2,
  ShieldCheck,
  Clock,
  TrendingUp,
  TrendingDown,
  Info,
  ArrowUpRight,
} from 'lucide-react'
import { Area, AreaChart, CartesianGrid, Pie, PieChart, ResponsiveContainer, Tooltip, Cell } from 'recharts'

const PANAMA_TIME_ZONE = 'America/Panama'

function getPanamaDateKey(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: PANAMA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

function getPanamaDateParts(date: Date): { year: number; month: number } {
  const [year, month] = getPanamaDateKey(date).split('-').map(Number)
  return { year, month }
}

function shiftDateKey(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function isCreatedToday(createdAt: string, referenceDate = new Date()): boolean {
  if (!createdAt) return false

  const createdDate = new Date(createdAt)
  return !Number.isNaN(createdDate.getTime()) && getPanamaDateKey(createdDate) === getPanamaDateKey(referenceDate)
}

function isCreatedOnDay(createdAt: string, date: Date | string): boolean {
  if (!createdAt) return false

  const createdDate = new Date(createdAt)
  const dateKey = typeof date === 'string' ? date : getPanamaDateKey(date)
  return !Number.isNaN(createdDate.getTime()) && getPanamaDateKey(createdDate) === dateKey
}

function formatApiDate(date: Date): string {
  return getPanamaDateKey(date)
}

type AccentKey = 'slate' | 'emerald' | 'amber' | 'violet' | 'sky'
const ACCENTS: Record<AccentKey, { bar: string; chipBg: string; chipFg: string; ring: string; text: string; stroke: string }> = {
  slate: { bar: 'bg-slate-400/70', chipBg: 'bg-slate-500/10', chipFg: 'text-slate-600 dark:text-slate-300', ring: 'ring-slate-500/20', text: 'text-slate-600 dark:text-slate-300', stroke: '#64748b' },
  emerald: { bar: 'bg-emerald-500/70', chipBg: 'bg-emerald-500/10', chipFg: 'text-emerald-600 dark:text-emerald-400', ring: 'ring-emerald-500/20', text: 'text-emerald-600 dark:text-emerald-400', stroke: '#10b981' },
  amber: { bar: 'bg-amber-500/70', chipBg: 'bg-amber-500/10', chipFg: 'text-amber-600 dark:text-amber-400', ring: 'ring-amber-500/20', text: 'text-amber-600 dark:text-amber-400', stroke: '#f59e0b' },
  violet: { bar: 'bg-violet-500/70', chipBg: 'bg-violet-500/10', chipFg: 'text-violet-600 dark:text-violet-400', ring: 'ring-violet-500/20', text: 'text-violet-600 dark:text-violet-400', stroke: '#8b5cf6' },
  sky: { bar: 'bg-sky-500/70', chipBg: 'bg-sky-500/10', chipFg: 'text-sky-600 dark:text-sky-400', ring: 'ring-sky-500/20', text: 'text-sky-600 dark:text-sky-400', stroke: '#0ea5e9' },
}

function AnimatedNumber({ value }: { value: number }) {
  const [displayValue, setDisplayValue] = React.useState(0)

  React.useEffect(() => {
    let animationFrame = 0
    const startTimestamp = performance.now()

    const animate = (timestamp: number) => {
      const progress = Math.min((timestamp - startTimestamp) / 450, 1)
      setDisplayValue(Math.round(progress * value))

      if (progress < 1) {
        animationFrame = window.requestAnimationFrame(animate)
      }
    }

    animationFrame = window.requestAnimationFrame(animate)

    return () => window.cancelAnimationFrame(animationFrame)
  }, [value])

  return <span className="tabular-nums">{displayValue}</span>
}

function Sparkline({ points, activeColor }: { points: number[]; activeColor: string }) {
  const width = 120
  const height = 40
  const max = Math.max(...points, 1)
  const min = Math.min(...points, 0)
  const range = max - min || 1
  const coords = points.map((point, index) => {
    const x = (index / Math.max(points.length - 1, 1)) * width
    const y = height - ((point - min) / range) * height
    return `${x},${y}`
  }).join(' ')

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-10 w-full overflow-visible" aria-hidden="true">
      <defs>
        <linearGradient id={`spark-gradient-${activeColor.replace('#', '')}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={activeColor} stopOpacity="0.42" />
          <stop offset="100%" stopColor={activeColor} stopOpacity="0.04" />
        </linearGradient>
      </defs>
      <polyline fill="none" stroke={activeColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points={coords} />
      <polygon points={`0,${height} ${coords} ${width},${height}`} fill={`url(#spark-gradient-${activeColor.replace('#', '')})`} opacity="0.85" />
    </svg>
  )
}

function StatCard({
  label,
  value,
  delta,
  icon: Icon,
  accent,
  sparkline,
}: {
  label: string
  value: number
  delta: number
  icon: React.ComponentType<{ className?: string }>
  accent: AccentKey
  sparkline: number[]
}) {
  const a = ACCENTS[accent]
  const isPositive = delta >= 0

  return (
    <Card className="dashboard-soft-surface group relative overflow-hidden rounded-[1.4rem] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_22px_48px_-28px_rgba(15,23,42,0.35)]">
      <span className={`absolute inset-x-0 top-0 h-0.5 ${a.bar}`} aria-hidden="true" />
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
            <p className="mt-3 metric-number">
              <AnimatedNumber value={value} />
            </p>
            <div className="mt-2 flex items-center gap-2 text-xs font-semibold">
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 ${isPositive ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'}`}>
                {isPositive ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
                {Math.abs(delta)}%
              </span>
              <span className="text-muted-foreground">vs. día anterior</span>
            </div>
          </div>
          <span
            className={`flex size-11 shrink-0 items-center justify-center rounded-2xl ring-1 transition-all duration-300 group-hover:scale-105 ${a.chipBg} ${a.chipFg} ${a.ring}`}
            aria-hidden="true"
          >
            <Icon className="size-5" />
          </span>
        </div>

        <div className="mt-4 rounded-2xl border border-border/60 bg-background/60 px-3 py-2 backdrop-blur-sm">
          <Sparkline points={sparkline} activeColor={a.stroke} />
        </div>
      </CardContent>
    </Card>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  const { hasPermission } = usePermissions()
  const navigate = useNavigate()
  const [currentDay, setCurrentDay] = React.useState(new Date())
  const { year: currentYear, month: currentMonthNumber } = getPanamaDateParts(currentDay)
  const currentMonth = MONTHS[currentMonthNumber - 1]
  const [reportsLoading, setReportsLoading] = React.useState(true)
  const [reports, setReports] = React.useState<Report[]>([])
  const reportsRef = React.useRef<Report[]>([])
  const lastSyncRef = React.useRef<number>(0)
  const [dashboardStats, setDashboardStats] = React.useState<DashboardStats | null>(null)
  const [statsReloadKey, setStatsReloadKey] = React.useState(0)

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
          setReportsLoading(true)
        }

        const normalizedReports = (await loadReportsForMonth(currentMonth, currentYear)).filter((report): report is Report => hasValidReportMeta(report))

        if (!isMounted) {
          return
        }

        setReports(normalizedReports)
        reportsRef.current = normalizedReports
        lastSyncRef.current = Date.now()
      } catch (err) {
        console.error('Error sincronizando reportes:', err)
        if (isMounted) {
          setReports([])
          reportsRef.current = []
          lastSyncRef.current = Date.now()
        }
      } finally {
        if (isMounted) {
          setReportsLoading(false)
        }
      }
    }

    void syncReports(true)

    return () => {
      isMounted = false
    }
  }, [currentYear, currentMonth])

  React.useEffect(() => {
    let isMounted = true

    void fetchDashboardStats(formatApiDate(currentDay))
      .then(nextStats => {
        if (isMounted) {
          setDashboardStats(nextStats)
        }
      })
      .catch(error => {
        console.error('Error sincronizando estadísticas del dashboard:', error)
        if (isMounted) {
          setDashboardStats(null)
        }
      })

    return () => {
      isMounted = false
    }
  }, [currentDay, statsReloadKey])

  React.useEffect(() => {
    const ticker = window.setInterval(() => {
      const now = new Date()
      if (getPanamaDateKey(now) !== getPanamaDateKey(currentDay)) {
        setCurrentDay(now)
      }
    }, 60000)

    return () => {
      window.clearInterval(ticker)
    }
  }, [currentDay])

  const handleRealtimeReport = React.useCallback((event: RealtimeEvent<any>) => {
    if (event.type === 'INSERT' || event.type === 'UPDATE') {
      const incoming = normalizeReportRecord(event.record as Record<string, unknown>)
      if (incoming.month !== currentMonth || incoming.year !== currentYear) {
        setStatsReloadKey(key => key + 1)
        return
      }
      const next = [incoming, ...reportsRef.current.filter(r => r.id !== incoming.id)]
      reportsRef.current = next
      setReports(next)
      setStatsReloadKey(key => key + 1)
    } else if (event.type === 'DELETE') {
      const removedId = String((event.oldRecord ?? event.record)?.id ?? '')
      if (!removedId) {
        return
      }
      const next = reportsRef.current.filter(r => r.id !== removedId)
      reportsRef.current = next
      setReports(next)
      setStatsReloadKey(key => key + 1)
    }
  }, [currentMonth, currentYear])

  useRealtimeReports(handleRealtimeReport)

  const displayName = user?.user_metadata?.full_name ?? user?.email ?? 'Usuario'
  const userRoles = getUserRoles(user)

  const todayReports = React.useMemo(
    () => reports.filter(r => hasValidReportMeta(r) && isCreatedToday(r.created_at, currentDay)),
    [reports, currentDay]
  )

  const dashboardReady = !reportsLoading && dashboardStats !== null

  const totalReports = dashboardStats?.total ?? todayReports.length

  const { totalFinalized, totalPending, totalValidacion, totalInformativo } = React.useMemo(() => ({
    totalFinalized: dashboardStats
      ? ['Caso Finalizado', 'Informativo', 'Validacion'].reduce((sum, status) => sum + (dashboardStats.byStatus[status] ?? 0), 0)
      : todayReports.filter(r => isFinalizedStatus(r.status)).length,
    totalPending: dashboardStats?.byStatus['Seguimiento de caso'] ?? todayReports.filter(r => r.status === 'Seguimiento de caso').length,
    totalValidacion: dashboardStats?.byStatus.Validacion ?? todayReports.filter(r => r.status === 'Validacion').length,
    totalInformativo: dashboardStats?.byStatus.Informativo ?? todayReports.filter(r => r.status === 'Informativo').length,
  }), [dashboardStats, todayReports])

  const previousDay = React.useMemo(() => shiftDateKey(getPanamaDateKey(currentDay), -1), [currentDay])

  const previousDayReports = React.useMemo(
    () => reports.filter(r => hasValidReportMeta(r) && isCreatedOnDay(r.created_at, previousDay)),
    [reports, previousDay]
  )

  const previousDayCount = previousDayReports.length

  const deltaTotal = previousDayCount === 0 ? 100 : Math.round(((totalReports - previousDayCount) / Math.max(previousDayCount, 1)) * 100)
  const deltaFinalized = previousDayCount === 0 ? 100 : Math.round(((totalFinalized - previousDayReports.filter(r => isFinalizedStatus(r.status)).length) / Math.max(previousDayReports.filter(r => isFinalizedStatus(r.status)).length || 1, 1)) * 100)
  const deltaPending = previousDayCount === 0 ? 100 : Math.round(((totalPending - previousDayReports.filter(r => r.status === 'Seguimiento de caso').length) / Math.max(previousDayReports.filter(r => r.status === 'Seguimiento de caso').length || 1, 1)) * 100)
  const deltaValidacion = previousDayCount === 0 ? 100 : Math.round(((totalValidacion - previousDayReports.filter(r => r.status === 'Validacion').length) / Math.max(previousDayReports.filter(r => r.status === 'Validacion').length || 1, 1)) * 100)
  const deltaInformativo = previousDayCount === 0 ? 100 : Math.round(((totalInformativo - previousDayReports.filter(r => r.status === 'Informativo').length) / Math.max(previousDayReports.filter(r => r.status === 'Informativo').length || 1, 1)) * 100)

  const dailySeries = React.useMemo(() => {
    const seriesMap = new Map<string, number>()

    reports.forEach(report => {
      if (!hasValidReportMeta(report)) {
        return
      }

      const created = new Date(report.created_at)
      if (Number.isNaN(created.getTime())) {
        return
      }

      const key = getPanamaDateKey(created)
      seriesMap.set(key, (seriesMap.get(key) ?? 0) + 1)
    })

    const ordered = Array.from(seriesMap.entries()).sort(([a], [b]) => a.localeCompare(b))
    const lastPoints = ordered.slice(-14)

    return lastPoints.map(([key, value]) => ({
      date: key,
      reports: value,
    }))
  }, [reports])

  const chartSeries = dailySeries.length > 0 ? dailySeries : [{ date: formatApiDate(currentDay), reports: 0 }]

  const recentSevenDays = React.useMemo(() => {
    const len = 7
    const output: number[] = []
    for (let index = len - 1; index >= 0; index -= 1) {
      const day = shiftDateKey(getPanamaDateKey(currentDay), -index)
      const count = reports.filter(r => hasValidReportMeta(r) && isCreatedOnDay(r.created_at, day)).length
      output.push(count)
    }
    return output
  }, [reports, currentDay])

  const sparklineByStatus = React.useMemo(() => ({
    total: recentSevenDays,
    finalized: recentSevenDays.map((_, index) => {
      const day = shiftDateKey(getPanamaDateKey(currentDay), -(recentSevenDays.length - 1 - index))
      return reports.filter(r => hasValidReportMeta(r) && isCreatedOnDay(r.created_at, day) && isFinalizedStatus(r.status)).length
    }),
    pending: recentSevenDays.map((_, index) => {
      const day = shiftDateKey(getPanamaDateKey(currentDay), -(recentSevenDays.length - 1 - index))
      return reports.filter(r => hasValidReportMeta(r) && isCreatedOnDay(r.created_at, day) && r.status === 'Seguimiento de caso').length
    }),
    validacion: recentSevenDays.map((_, index) => {
      const day = shiftDateKey(getPanamaDateKey(currentDay), -(recentSevenDays.length - 1 - index))
      return reports.filter(r => hasValidReportMeta(r) && isCreatedOnDay(r.created_at, day) && r.status === 'Validacion').length
    }),
    informativo: recentSevenDays.map((_, index) => {
      const day = shiftDateKey(getPanamaDateKey(currentDay), -(recentSevenDays.length - 1 - index))
      return reports.filter(r => hasValidReportMeta(r) && isCreatedOnDay(r.created_at, day) && r.status === 'Informativo').length
    }),
  }), [reports, currentDay])

  const donutData = [
    { name: 'Finalizados', value: totalFinalized, color: '#10b981' },
    { name: 'Seguimiento', value: totalPending, color: '#f59e0b' },
    { name: 'Validacion', value: totalValidacion, color: '#8b5cf6' },
    { name: 'Informativo', value: totalInformativo, color: '#0ea5e9' },
  ]

  return (
    <div className="p-6">
      <div className="floating-surface relative min-h-[calc(100vh-5rem)] overflow-hidden rounded-[2rem] border border-border/60 bg-card/95 p-6 shadow-[0_30px_90px_-46px_rgba(15,23,42,0.45)] backdrop-blur-md md:p-8">
        <span className="brand-gradient-bg pointer-events-none absolute inset-x-0 top-0 h-1 opacity-80" aria-hidden="true" />
        <div className="space-y-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="mb-1.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                <span className="brand-gradient-bg size-1.5 rounded-full" aria-hidden="true" />
                Panel de control
              </p>
              <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
                Bienvenido, <span className={getNameColorClasses(displayName)}>{displayName.split(' ')[0]}</span>
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Hoy, {currentDay.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {userRoles.map(role => (
                  <Badge key={role} className={`text-[12px] font-semibold px-1.5 py-0.5 ${getRoleColorClasses(role, displayName)}`}>
                    {role.toUpperCase()}
                  </Badge>
                ))}
                <Badge variant="secondary" className="text-xs">
                  {user?.email ?? 'Usuario'}
                </Badge>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {hasPermission(PERMISSIONS.REPORTS.EXPORT as any) && (
                <Button
                  variant="outline"
                  className="rounded-xl border-border/70 px-4 py-2 text-sm font-medium shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
                  onClick={() => {
                    const month = MONTHS[currentDay.getMonth()]
                    const year = currentDay.getFullYear()
                    navigate(`/informes?export=1&month=${encodeURIComponent(month)}&year=${year}`)
                  }}
                >
                  Exportar
                </Button>
              )}
              <Button
                onClick={() => navigate('/informes/nuevo')}
                className="gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-[0_16px_42px_-20px_rgba(99,102,241,0.95)] transition-all hover:-translate-y-0.5 hover:shadow-[0_20px_48px_-20px_rgba(99,102,241,0.95)]"
              >
                <FilePlus className="size-4" />
                Nuevo Informe
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
            <StatCard label="Total Informes" value={totalReports} delta={deltaTotal} icon={FileText} accent="slate" sparkline={sparklineByStatus.total} />
            <StatCard label="Finalizados" value={totalFinalized} delta={deltaFinalized} icon={CheckCircle2} accent="emerald" sparkline={sparklineByStatus.finalized} />
            <StatCard label="En Seguimiento" value={totalPending} delta={deltaPending} icon={Clock} accent="amber" sparkline={sparklineByStatus.pending} />
            <StatCard label="Validacion" value={totalValidacion} delta={deltaValidacion} icon={ShieldCheck} accent="violet" sparkline={sparklineByStatus.validacion} />
            <StatCard label="Informativo" value={totalInformativo} delta={deltaInformativo} icon={Info} accent="sky" sparkline={sparklineByStatus.informativo} />
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.65fr_0.9fr]">
            <Card className="dashboard-soft-surface rounded-[1.6rem] border border-border/60 bg-card/70 p-0 shadow-[0_22px_60px_-30px_rgba(15,23,42,0.32)]">
              <CardHeader className="px-5 pb-3 pt-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg font-semibold">Evolución de informes</CardTitle>
                    <CardDescription>Informes creados por día</CardDescription>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-indigo-500/10 px-2.5 py-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-300">
                    <ArrowUpRight className="size-3.5" />
                    {dashboardReady && dailySeries.length > 0 ? dailySeries[dailySeries.length - 1].reports : 0} hoy
                  </span>
                </div>
              </CardHeader>
              <CardContent className="px-5 pb-5 pt-1">
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartSeries} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="reportsAreaGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#6366f1" stopOpacity="0.42" />
                          <stop offset="55%" stopColor="#8b5cf6" stopOpacity="0.18" />
                          <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.03" />
                        </linearGradient>
                      </defs>
                      <CartesianGrid vertical={false} stroke="rgba(148,163,184,0.18)" strokeDasharray="4 4" />
                      <Tooltip
                        cursor={{ stroke: '#6366f1', strokeWidth: 1, strokeDasharray: '4 4' }}
                        contentStyle={{
                          borderRadius: 16,
                          border: '1px solid rgba(148,163,184,0.28)',
                          background: 'rgba(255,255,255,0.94)',
                          boxShadow: '0 18px 48px -24px rgba(15,23,42,0.42)',
                        }}
                        formatter={(value) => [`${Number(value ?? 0)} informes`, 'Cantidad']}
                        labelFormatter={(label) => `Día ${label}`}
                      />
                      <Area
                        type="monotone"
                        dataKey="reports"
                        stroke="#6366f1"
                        strokeWidth={3}
                        fill="url(#reportsAreaGradient)"
                        fillOpacity={1}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="dashboard-soft-surface rounded-[1.6rem] border border-border/60 bg-card/70 shadow-[0_22px_60px_-30px_rgba(15,23,42,0.32)]">
              <CardHeader className="px-5 pb-3 pt-5">
                <CardTitle className="text-lg font-semibold">Distribución por tipo</CardTitle>
                <CardDescription>Resumen del día</CardDescription>
              </CardHeader>
              <CardContent className="px-5 pb-5">
                <div className="grid grid-cols-[1fr_auto] items-center gap-3">
                  <div className="h-[240px] w-full relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={donutData}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={54}
                          outerRadius={82}
                          paddingAngle={3}
                          stroke="transparent"
                        >
                          {donutData.map(entry => (
                            <Cell key={entry.name} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            borderRadius: 14,
                            border: '1px solid rgba(148,163,184,0.28)',
                            background: 'rgba(255,255,255,0.94)',
                          }}
                          formatter={(value) => [`${Number(value ?? 0)}`, 'Informes']}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <div className="text-center">
                        <div className="donut-center-number">
                          <AnimatedNumber value={totalReports} />
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">Total Informes</div>
                      </div>
                    </div>
                  </div>

                  <div className="min-w-[126px] text-center">
                    <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Total</div>
                    <div className="mt-2 text-4xl font-bold tracking-tight text-foreground">
                      <AnimatedNumber value={totalReports} />
                    </div>
                  </div>
                </div>

                <div className="mt-2 space-y-2">
                  {donutData.map(item => (
                    <div key={item.name} className="flex items-center justify-between rounded-xl border border-border/60 bg-background/60 px-3 py-2 text-sm">
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <span className="size-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                        {item.name}
                      </span>
                      <span className="font-semibold text-foreground tabular-nums">{item.value}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="dashboard-soft-surface rounded-[1.6rem] border border-border/60 bg-card/70 shadow-[0_22px_60px_-30px_rgba(15,23,42,0.32)]">
            <CardHeader className="px-5 pb-3 pt-5">
              <CardTitle className="text-lg font-semibold">Resumen del día</CardTitle>
              <CardDescription>{currentDay.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
                      return !['SOAT', 'SALDO MOROSO', 'RENOVACION NO PAGADA', 'SERVICIO UTILIZADO', 'BENEFICIO EN 24H', 'POLIZA CANCELADA', 'NO CUBIERTO POR LA POLIZA'].some(keyword => bucketText.includes(keyword))
                    }).length

                return (
                  <div key={label} className="group rounded-2xl border border-border/60 bg-background/55 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-border hover:bg-accent/70 hover:shadow-sm">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
                    <p className={`mt-3 text-3xl font-bold tabular-nums ${color}`}><AnimatedNumber value={count} /></p>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
