import * as React from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { useAuth, getUserRoles } from '@/lib/auth'
import { closeShift, deleteClosedShift, getShiftDetail, listShifts, startShift, type Shift, type ShiftReport } from '@/lib/shift-service'
import { PERMISSIONS } from '@/lib/permissions'
import { usePermissions } from '@/lib/permissions-context'
import { toast } from 'sonner'
import { Download, Eye, LogIn, LogOut, Trash2 } from 'lucide-react'

const dateFormatter = new Intl.DateTimeFormat('es-PA', { dateStyle: 'medium', timeStyle: 'short' })
const shortDateFormatter = new Intl.DateTimeFormat('es-PA', { dateStyle: 'short' })
const timeFormatter = new Intl.DateTimeFormat('es-PA', { timeStyle: 'short' })
const allowedRoles = ['Admin', 'Support', 'Gerente']
type ShiftPeriod = 'all' | 'today' | '7' | '30'
const shiftSummaryConfig = [
  { key: 'total', label: 'TOTAL DE INFORMES', accent: 'slate', icon: '🗂️' },
  { key: 'finalized', label: 'FINALIZADOS', accent: 'emerald', icon: '✓' },
  { key: 'pending', label: 'EN SEGUIMIENTO', accent: 'amber', icon: '◔' },
  { key: 'validacion', label: 'VALIDACION', accent: 'violet', icon: '✓' },
  { key: 'informativo', label: 'INFORMATIVO', accent: 'sky', icon: 'i' },
] as const

function getShiftSummaryStats(reports: ShiftReport[]) {
  const total = reports.length
  const finalized = reports.filter(report => ['Caso Finalizado', 'Informativo', 'Validacion'].includes(report.status)).length
  const pending = reports.filter(report => report.status === 'Seguimiento de caso').length
  const validacion = reports.filter(report => report.status === 'Validacion').length
  const informativo = reports.filter(report => report.status === 'Informativo').length

  return { total, finalized, pending, validacion, informativo }
}

function buildSparkline(values: number[]) {
  const normalized = values.length === 0 ? [0, 0, 0, 0, 0, 0, 0] : values
  const max = Math.max(...normalized, 1)
  const min = Math.min(...normalized, 0)
  const range = max - min || 1
  const points = normalized.map((value, index) => {
    const x = (index / Math.max(normalized.length - 1, 1)) * 100
    const y = 100 - ((value - min) / range) * 100
    return `${x},${y}`
  }).join(' ')
  return points
}

function formatDate(value: string | null) {
  return value ? dateFormatter.format(new Date(value)) : 'En curso'
}

function formatDuration(startedAt: string, endedAt: string | null, reference = Date.now()) {
  const end = endedAt ? new Date(endedAt).getTime() : reference
  const minutes = Math.max(0, Math.floor((end - new Date(startedAt).getTime()) / 60000))
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}

function printShift(shift: Shift, reports: ShiftReport[]) {
  const popup = window.open('', '_blank', 'width=1000,height=760')
  if (!popup) {
    toast.error('Permite las ventanas emergentes para generar el PDF.')
    return
  }

  const stats = getShiftSummaryStats(reports)
  const sparklineMap = {
    total: buildSparkline([Math.max(0, stats.total - 2), Math.max(0, stats.total - 1), stats.total, Math.max(0, stats.total - 3), Math.max(0, stats.total - 1), stats.total, Math.max(0, stats.total - 2)]),
    finalized: buildSparkline([Math.max(0, stats.finalized - 2), Math.max(0, stats.finalized - 1), stats.finalized, Math.max(0, stats.finalized - 3), Math.max(0, stats.finalized - 1), stats.finalized, Math.max(0, stats.finalized - 2)]),
    pending: buildSparkline([Math.max(0, stats.pending - 2), Math.max(0, stats.pending - 1), stats.pending, Math.max(0, stats.pending - 3), Math.max(0, stats.pending - 1), stats.pending, Math.max(0, stats.pending - 2)]),
    validacion: buildSparkline([Math.max(0, stats.validacion - 2), Math.max(0, stats.validacion - 1), stats.validacion, Math.max(0, stats.validacion - 3), Math.max(0, stats.validacion - 1), stats.validacion, Math.max(0, stats.validacion - 2)]),
    informativo: buildSparkline([Math.max(0, stats.informativo - 2), Math.max(0, stats.informativo - 1), stats.informativo, Math.max(0, stats.informativo - 3), Math.max(0, stats.informativo - 1), stats.informativo, Math.max(0, stats.informativo - 2)]),
  }

  const cardsHtml = shiftSummaryConfig.map((item) => {
    const key = item.key === 'total' ? 'total' : item.key
    const value = key === 'total' ? stats.total : key === 'finalized' ? stats.finalized : key === 'pending' ? stats.pending : key === 'validacion' ? stats.validacion : stats.informativo
    const colorMap = {
      slate: '#64748b',
      emerald: '#10b981',
      amber: '#f59e0b',
      violet: '#8b5cf6',
      sky: '#0ea5e9',
    }

    return `<div class="card"><div class="card-top"><div class="label">${item.label}</div><div class="icon" style="background:${item.accent === 'slate' ? '#e2e8f0' : item.accent === 'emerald' ? '#d1fae5' : item.accent === 'amber' ? '#fef3c7' : item.accent === 'violet' ? '#e9d5ff' : '#dbeafe'}; color:${colorMap[item.accent]};">${item.icon}</div></div><div class="value">${value}</div><div class="delta">0% vs. día anterior</div><svg viewBox="0 0 100 40" class="sparkline"><polyline fill="none" stroke="${colorMap[item.accent]}" stroke-width="2.5" points="${sparklineMap[key]}" /></svg></div>`
  }).join('')

  popup.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Turno del supervisor ${shift.supervisorName}</title><style>body{font-family:Arial,sans-serif;background:#f8fafc;color:#172033;padding:28px}h1{margin:0 0 8px;font-size:26px}p{margin:6px 0;color:#536078}.header{margin-bottom:18px}.grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:14px}.card{border:1px solid #dfe7f1;border-radius:20px;padding:14px 12px;background:#fff;box-shadow:0 12px 30px -24px rgba(15,23,42,.45)}.card-top{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}.label{font-size:11px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:#64748b;white-space:pre-line;line-height:1.4}.icon{width:38px;height:38px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700}.value{font-size:50px;line-height:1;font-weight:900;letter-spacing:-.08em;margin-top:16px}.delta{margin-top:10px;font-size:12px;color:#64748b}.sparkline{width:100%;height:36px;margin-top:12px;display:block}.meta{margin-top:18px;border:1px solid #e2e8f0;border-radius:12px;padding:12px 14px;background:#fff}.meta strong{display:inline-block;min-width:140px}@media print{body{padding:0}.grid{grid-template-columns:repeat(5,minmax(0,1fr))}}</style></head><body><div class="header"><h1>Turno del supervisor ${shift.supervisorName}</h1><p>${shift.supervisorEmail}</p></div><div class="meta"><strong>Estado:</strong> ${shift.status === 'closed' ? 'Cerrado' : 'En curso'}<br><strong>Inicio:</strong> ${formatDate(shift.startedAt)}<br><strong>Cierre:</strong> ${formatDate(shift.endedAt)}</div><div class="grid" style="margin-top:18px;">${cardsHtml}</div><script>window.onload=()=>window.print()</script></body></html>`)
  popup.document.close()
}

export default function Shifts() {
  const { user } = useAuth()
  const { hasPermission } = usePermissions()
  const [shifts, setShifts] = React.useState<Shift[]>([])
  const [selected, setSelected] = React.useState<{ shift: Shift; reports: ShiftReport[] } | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [working, setWorking] = React.useState(false)
  const [closeDialogOpen, setCloseDialogOpen] = React.useState(false)
  const [closingObservation, setClosingObservation] = React.useState('')
  const [now, setNow] = React.useState(() => Date.now())
  const [period, setPeriod] = React.useState<ShiftPeriod>('all')
  const canManage = getUserRoles(user).some(role => allowedRoles.includes(role))
  const canDeleteClosedShifts = hasPermission(PERMISSIONS.SHIFTS.DELETE_CLOSED)
  const currentOpenShift = shifts.find(shift => shift.status === 'open' && String(shift.supervisorId) === String(user?.id))

  const refresh = React.useCallback(async () => {
    try {
      setLoading(true)
      setShifts(await listShifts(user))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudieron cargar los turnos.')
    } finally {
      setLoading(false)
    }
  }, [user])

  React.useEffect(() => { void refresh() }, [refresh])
  React.useEffect(() => {
    const interval = window.setInterval(() => void refresh(), 30000)
    return () => window.clearInterval(interval)
  }, [refresh])
  React.useEffect(() => {
    if (!currentOpenShift) return
    const interval = window.setInterval(() => setNow(Date.now()), 60000)
    return () => window.clearInterval(interval)
  }, [currentOpenShift])

  const handleStart = async () => {
    try { setWorking(true); await startShift(user); toast.success('Turno iniciado.'); await refresh() }
    catch (error) { toast.error(error instanceof Error ? error.message : 'No se pudo iniciar el turno.') }
    finally { setWorking(false) }
  }

  const handleClose = async () => {
    if (!currentOpenShift) return
    setClosingObservation('')
    setCloseDialogOpen(true)
  }

  const confirmClose = async () => {
    if (!currentOpenShift) return
    try { setWorking(true); await closeShift(currentOpenShift.id, user, closingObservation); toast.success('Turno cerrado.'); await refresh() }
    catch (error) { toast.error(error instanceof Error ? error.message : 'No se pudo cerrar el turno.') }
    finally { setWorking(false); setCloseDialogOpen(false) }
  }

  const showDetail = async (shift: Shift) => {
    try { setWorking(true); setSelected(await getShiftDetail(shift.id, user)) }
    catch (error) { toast.error(error instanceof Error ? error.message : 'No se pudo cargar el detalle.') }
    finally { setWorking(false) }
  }

  const handleDelete = async (shift: Shift) => {
    if (shift.status !== 'closed' || !canDeleteClosedShifts) return
    if (!window.confirm(`¿Quieres eliminar el turno cerrado de ${shift.supervisorName}? Esta acción no se puede deshacer.`)) return

    try {
      setWorking(true)
      await deleteClosedShift(shift.id, user)
      setShifts(current => current.filter(item => item.id !== shift.id))
      setSelected(current => current?.shift.id === shift.id ? null : current)
      toast.success('Turno cerrado eliminado.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo eliminar el turno.')
    } finally {
      setWorking(false)
    }
  }

  const periodStart = React.useMemo(() => {
    if (period === 'all') return null
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    const days = period === 'today' ? 1 : Number(period)
    return start.getTime() - ((days - 1) * 24 * 60 * 60 * 1000)
  }, [now, period])

  const visibleShifts = React.useMemo(() => {
    const ordered = [...shifts].sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
    if (period === 'all' || !periodStart) {
      return ordered
    }

    return ordered.filter(shift => new Date(shift.startedAt).getTime() >= periodStart)
  }, [period, periodStart, shifts])

  const todayShifts = shifts.filter(shift => new Date(shift.startedAt).toDateString() === new Date(now).toDateString())
  const totalGeneratedReports = visibleShifts.reduce((total, shift) => total + shift.generatedReports, 0)
  const averageReportsPerShift = visibleShifts.length > 0 ? (totalGeneratedReports / visibleShifts.length).toFixed(1) : '0'
  const activeReports = currentOpenShift?.reportCount ?? 0
  const supervisorPerformance = Array.from(visibleShifts.reduce((groups, shift) => {
    const current = groups.get(shift.supervisorName) || { name: shift.supervisorName, reports: 0, hours: 0, active: false }
    current.reports += shift.generatedReports
    current.hours += Math.max(1 / 60, (new Date(shift.endedAt || new Date(now).toISOString()).getTime() - new Date(shift.startedAt).getTime()) / 3600000)
    current.active = current.active || shift.status === 'open'
    groups.set(shift.supervisorName, current)
    return groups
  }, new Map<string, { name: string; reports: number; hours: number; active: boolean }>()).values())

  if (!canManage) return null

  return <main className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-6">
    <header className="flex flex-col justify-between gap-5 border-b border-border pb-6 lg:flex-row lg:items-end">
      <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Control operativo</p><h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Gestión de turnos</h1><p className="mt-2 text-muted-foreground">Supervisión y productividad operacional</p></div>
      <Button size="lg" variant={currentOpenShift ? 'secondary' : 'default'} onClick={() => currentOpenShift ? void handleClose() : void handleStart()} disabled={working}><span className={currentOpenShift ? 'mr-2 size-2 rounded-full bg-emerald-500' : 'mr-2'}>{currentOpenShift ? '' : '▶'}</span>{currentOpenShift ? 'Turno activo' : 'Iniciar turno'}</Button>
    </header>

    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {[['Turnos de hoy', String(todayShifts.length), 'Registro del día'], ['Supervisores activos', String(shifts.filter(shift => shift.status === 'open').length), 'En operación'], ['Informes generados', String(totalGeneratedReports), period === 'all' ? 'Historial completo' : `Período: ${period === 'today' ? 'hoy' : `${period} días`}`], ['Promedio por turno', averageReportsPerShift, 'Informes generados']].map(([label, value, caption]) => <Card key={label} className="border-border/70 shadow-sm"><CardContent className="p-5"><p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-3 text-3xl font-semibold tracking-tight">{value}</p><p className="mt-1 text-xs text-muted-foreground">{caption}</p></CardContent></Card>)]}
    </section>

    {currentOpenShift ? <Card className="border-primary/30 bg-primary/[0.03] shadow-sm"><CardHeader className="flex flex-row items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-wider text-primary">Turno activo</p><CardTitle className="mt-1">{currentOpenShift.supervisorName}</CardTitle><CardDescription className="mt-1"><span className="mr-1 inline-block size-2 rounded-full bg-emerald-500" />En operación desde {timeFormatter.format(new Date(currentOpenShift.startedAt))}</CardDescription></div><Badge variant="secondary">{formatDuration(currentOpenShift.startedAt, null, now)}</Badge></CardHeader><CardContent className="grid gap-3 sm:grid-cols-3"><div className="rounded-lg border border-border/70 bg-background/70 p-4"><p className="text-xs uppercase tracking-wider text-muted-foreground">Informes al inicio</p><p className="mt-2 text-2xl font-semibold">{currentOpenShift.reportsAtStart}</p></div><div className="rounded-lg border border-border/70 bg-background/70 p-4"><p className="text-xs uppercase tracking-wider text-muted-foreground">Informes actuales</p><p className="mt-2 text-2xl font-semibold">{activeReports}</p></div><div className="rounded-lg border border-border/70 bg-background/70 p-4"><p className="text-xs uppercase tracking-wider text-muted-foreground">Generados durante el turno</p><p className="mt-2 text-2xl font-semibold text-emerald-600">+{currentOpenShift.generatedReports}</p></div></CardContent></Card> : null}

    <Card className="border-border/70 shadow-sm"><CardHeader className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-semibold uppercase tracking-wider text-primary">Historial operativo</p><CardTitle className="mt-1">Actividad de supervisores</CardTitle><CardDescription>Registro de actividad y productividad operacional.</CardDescription></div><div className="flex gap-1 rounded-lg border bg-muted/40 p-1"><Button size="sm" variant={period === 'all' ? 'secondary' : 'ghost'} onClick={() => setPeriod('all')}>Todos</Button><Button size="sm" variant={period === 'today' ? 'secondary' : 'ghost'} onClick={() => setPeriod('today')}>Hoy</Button><Button size="sm" variant={period === '7' ? 'secondary' : 'ghost'} onClick={() => setPeriod('7')}>7 días</Button><Button size="sm" variant={period === '30' ? 'secondary' : 'ghost'} onClick={() => setPeriod('30')}>30 días</Button></div></CardHeader><CardContent>{loading ? <div className="flex justify-center py-12"><Spinner /></div> : visibleShifts.length === 0 ? <div className="py-12 text-center"><p className="font-medium">No hay actividad registrada</p><p className="mt-1 text-sm text-muted-foreground">Los turnos iniciados aparecerán aquí junto con sus métricas de productividad.</p>{!currentOpenShift ? <Button className="mt-5" onClick={() => void handleStart()} disabled={working}><LogIn className="mr-2 size-4" />Iniciar turno</Button> : null}</div> : <div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left text-sm"><thead><tr className="border-b text-xs uppercase tracking-wider text-muted-foreground"><th className="p-3 font-medium">Supervisor</th><th className="p-3 font-medium">Inicio</th><th className="p-3 font-medium">Cierre</th><th className="p-3 font-medium">Al inicio</th><th className="p-3 font-medium">Al cierre</th><th className="p-3 font-medium">Generados</th><th className="p-3 font-medium">Duración</th><th className="p-3 font-medium">Estado</th><th className="p-3 font-medium text-right">Acciones</th></tr></thead><tbody>{visibleShifts.map(shift => <tr key={shift.id} className="border-b border-border/60 transition-colors last:border-0 hover:bg-muted/30"><td className="p-3 font-medium">{shift.supervisorName}</td><td className="p-3 text-muted-foreground">{shortDateFormatter.format(new Date(shift.startedAt))} · {timeFormatter.format(new Date(shift.startedAt))}</td><td className="p-3 text-muted-foreground">{shift.endedAt ? timeFormatter.format(new Date(shift.endedAt)) : 'En curso'}</td><td className="p-3">{shift.reportsAtStart}</td><td className="p-3">{shift.reportsAtClose ?? '—'}</td><td className="p-3 font-medium">{shift.generatedReports}</td><td className="p-3 text-muted-foreground">{formatDuration(shift.startedAt, shift.endedAt, now)}</td><td className="p-3"><Badge variant={shift.status === 'closed' ? 'secondary' : 'default'}>{shift.status === 'closed' ? '✓ Cerrado' : '● Activo'}</Badge></td><td className="p-3"><div className="flex justify-end gap-2"><Button variant="outline" size="sm" onClick={() => void showDetail(shift)}><Eye className="mr-2 size-4" />Detalles</Button><Button variant="outline" size="sm" onClick={() => { if (selected?.shift.id === shift.id) printShift(selected.shift, selected.reports); else void getShiftDetail(shift.id, user).then(detail => printShift(detail.shift, detail.reports)) }}><Download className="mr-2 size-4" />PDF</Button>{shift.status === 'closed' && canDeleteClosedShifts ? <Button variant="destructive" size="sm" onClick={() => void handleDelete(shift)} disabled={working} aria-label="Eliminar turno cerrado"><Trash2 className="mr-2 size-4" /></Button> : null}</div></td></tr>)}</tbody></table></div>}</CardContent></Card>

    <section className="grid gap-6 lg:grid-cols-[1.35fr_1fr]"><Card className="border-border/70 shadow-sm"><CardHeader><p className="text-xs font-semibold uppercase tracking-wider text-primary">Rendimiento de supervisores</p><CardTitle className="mt-1">Productividad operacional</CardTitle></CardHeader><CardContent>{supervisorPerformance.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">Sin datos de productividad para este período.</p> : <div className="space-y-3">{supervisorPerformance.map(supervisor => <div key={supervisor.name} className="grid grid-cols-[1fr_auto_auto] items-center gap-4 rounded-lg border border-border/70 p-3"><div><p className="font-medium">{supervisor.name}</p><p className="text-xs text-muted-foreground">{supervisor.active ? 'En operación' : 'Sin turno activo'}</p></div><div className="text-right"><p className="font-semibold">{supervisor.reports}</p><p className="text-xs text-muted-foreground">informes</p></div><div className="text-right"><p className="font-semibold">{(supervisor.reports / supervisor.hours).toFixed(1)}</p><p className="text-xs text-muted-foreground">por hora</p></div></div>)}</div>}</CardContent></Card><Card className="border-border/70 shadow-sm"><CardHeader><p className="text-xs font-semibold uppercase tracking-wider text-primary">Actividad del turno</p><CardTitle className="mt-1">Eventos operativos</CardTitle></CardHeader><CardContent><div className="border-l border-border pl-4"><p className="text-sm font-medium">No hay eventos detallados</p><p className="mt-1 text-sm text-muted-foreground">La actividad aparecerá cuando existan eventos operativos registrados.</p></div></CardContent></Card></section>

    <Dialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>¿Cerrar turno?</DialogTitle><DialogDescription>Confirma el resumen operativo antes de finalizar el turno.</DialogDescription></DialogHeader>{currentOpenShift ? <div className="space-y-4"><div className="grid grid-cols-2 gap-3"><div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Supervisor</p><p className="mt-1 font-medium">{currentOpenShift.supervisorName}</p></div><div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Duración</p><p className="mt-1 font-medium">{formatDuration(currentOpenShift.startedAt, null, now)}</p></div><div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Informes al inicio</p><p className="mt-1 text-xl font-semibold">{currentOpenShift.reportsAtStart}</p></div><div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Informes actuales</p><p className="mt-1 text-xl font-semibold">{activeReports}</p></div></div><div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 dark:border-emerald-900 dark:bg-emerald-950/20"><p className="text-xs text-muted-foreground">Informes generados</p><p className="mt-1 text-2xl font-semibold text-emerald-600">+{currentOpenShift.generatedReports}</p></div><div className="space-y-2"><Label htmlFor="closing-observation">Observaciones del supervisor <span className="font-normal text-muted-foreground">(opcional)</span></Label><Textarea id="closing-observation" value={closingObservation} onChange={event => setClosingObservation(event.target.value)} placeholder="Añade una observación del cierre..." rows={3} /></div><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setCloseDialogOpen(false)} disabled={working}>Cancelar</Button><Button variant="destructive" onClick={() => void confirmClose()} disabled={working}>{working ? 'Cerrando...' : 'Confirmar cierre'}</Button></div></div> : null}</DialogContent></Dialog>

    <Dialog open={Boolean(selected)} onOpenChange={(open) => { if (!open) setSelected(null) }}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-6xl">{selected ? <><DialogHeader><DialogTitle>Detalle del turno</DialogTitle><DialogDescription>{selected.shift.supervisorName} · {shortDateFormatter.format(new Date(selected.shift.startedAt))}</DialogDescription></DialogHeader><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">{shiftSummaryConfig.map((item) => {
      const value = item.key === 'total' ? selected.reports.length : item.key === 'finalized' ? selected.reports.filter(report => ['Caso Finalizado', 'Informativo', 'Validacion'].includes(report.status)).length : item.key === 'pending' ? selected.reports.filter(report => report.status === 'Seguimiento de caso').length : item.key === 'validacion' ? selected.reports.filter(report => report.status === 'Validacion').length : selected.reports.filter(report => report.status === 'Informativo').length
      const accentClasses = {
        slate: 'border-slate-200 bg-slate-100/70 text-slate-700',
        emerald: 'border-emerald-200 bg-emerald-100/70 text-emerald-700',
        amber: 'border-amber-200 bg-amber-100/70 text-amber-700',
        violet: 'border-violet-200 bg-violet-100/70 text-violet-700',
        sky: 'border-sky-200 bg-sky-100/70 text-sky-700',
      } as const
      const sparkline = item.key === 'total' ? [Math.max(0, value - 2), Math.max(0, value - 1), value, Math.max(0, value - 3), Math.max(0, value - 1), value, Math.max(0, value - 2)] : item.key === 'finalized' ? [Math.max(0, value - 2), Math.max(0, value - 1), value, Math.max(0, value - 3), Math.max(0, value - 1), value, Math.max(0, value - 2)] : item.key === 'pending' ? [Math.max(0, value - 2), Math.max(0, value - 1), value, Math.max(0, value - 3), Math.max(0, value - 1), value, Math.max(0, value - 2)] : item.key === 'validacion' ? [Math.max(0, value - 2), Math.max(0, value - 1), value, Math.max(0, value - 3), Math.max(0, value - 1), value, Math.max(0, value - 2)] : [Math.max(0, value - 2), Math.max(0, value - 1), value, Math.max(0, value - 3), Math.max(0, value - 1), value, Math.max(0, value - 2)]
      const colors = {
        slate: '#64748b',
        emerald: '#10b981',
        amber: '#f59e0b',
        violet: '#8b5cf6',
        sky: '#0ea5e9',
      } as const
      return <div key={item.label} className="rounded-[1.8rem] border border-slate-200 bg-white/80 p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div className="space-y-2"><p className="whitespace-pre-line text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{item.label}</p><div className={`inline-flex size-10 items-center justify-center rounded-xl border ${accentClasses[item.accent]}`}><span className="text-lg font-bold">{item.icon}</span></div></div></div><div className="mt-4 text-5xl font-black tracking-[-0.06em] text-slate-900 tabular-nums">{value}</div><div className="mt-3 flex items-center gap-2 text-xs text-slate-500"><span className="text-sm font-semibold text-emerald-500">↗</span><span>0% vs. día anterior</span></div><div className="mt-4 h-12 overflow-hidden rounded-xl bg-slate-100/80 px-2 pt-2"><svg viewBox="0 0 120 40" className="h-full w-full" preserveAspectRatio="none"><polyline fill="none" stroke={colors[item.accent]} strokeWidth="2.5" strokeLinecap="round" points={buildSparkline(sparkline)} /></svg></div></div>
    })}</div><div className="mt-4 rounded-lg border bg-muted/20 p-4"><div className="grid gap-3 sm:grid-cols-3"><div><p className="text-xs text-muted-foreground">Inicio</p><p className="mt-1 font-medium">{formatDate(selected.shift.startedAt)}</p></div><div><p className="text-xs text-muted-foreground">Cierre</p><p className="mt-1 font-medium">{formatDate(selected.shift.endedAt)}</p></div><div><p className="text-xs text-muted-foreground">Informes generados</p><p className="mt-1 font-medium">{selected.shift.generatedReports}</p></div></div>{selected.shift.closingObservation ? <p className="mt-4 border-t pt-3 text-sm text-muted-foreground">{selected.shift.closingObservation}</p> : null}</div><div className="mt-4 flex justify-end"><Button onClick={() => printShift(selected.shift, selected.reports)}><Download className="mr-2 size-4" />Descargar PDF</Button></div></> : null}</DialogContent></Dialog>
  </main>
}
