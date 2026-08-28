import * as React from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { useAuth, getUserRoles } from '@/lib/auth'
import { closeShift, getShiftDetail, listShifts, startShift, type Shift, type ShiftReport } from '@/lib/shift-service'
import { toast } from 'sonner'
import { CheckCircle2, Clock3, Download, Eye, LogIn, LogOut, RefreshCw, Users } from 'lucide-react'

const dateFormatter = new Intl.DateTimeFormat('es-PA', { dateStyle: 'medium', timeStyle: 'short' })
const allowedRoles = ['Admin', 'Support', 'Gerente']
const shiftCategoryLabels = [
  ['SOAT', 'SOAT'],
  ['SALDO MOROSO', 'Saldo moroso'],
  ['RENOVACION NO PAGADA', 'Póliza vencida / renovación no pagada'],
  ['SERVICIO UTILIZADO', 'Servicio utilizado'],
  ['BENEFICIO EN 24H', 'Beneficio en 24h'],
  ['POLIZA CANCELADA', 'Póliza cancelada'],
  ['NO CUBIERTO POR LA POLIZA', 'No cubierto por la póliza'],
  ['OTROS', 'Otros'],
] as const

function formatDate(value: string | null) {
  return value ? dateFormatter.format(new Date(value)) : 'En curso'
}

function printShift(shift: Shift, reports: ShiftReport[]) {
  const popup = window.open('', '_blank', 'width=900,height=700')
  if (!popup) {
    toast.error('Permite las ventanas emergentes para generar el PDF.')
    return
  }

  const rows = reports.map(report => `<tr><td>${report.insured_name}</td><td>${report.plate}</td><td>${report.service_type}</td><td>${report.status}</td><td>${formatDate(report.created_at)}</td></tr>`).join('')
  popup.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Turno del supervisor ${shift.supervisorName}</title><style>body{font-family:Arial,sans-serif;color:#172033;padding:32px}h1{margin:0 0 6px;font-size:24px}p{margin:5px 0;color:#536078}.summary{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:24px 0}.box{border:1px solid #d8deea;border-radius:8px;padding:12px}.box strong{display:block;font-size:20px;margin-top:5px}table{border-collapse:collapse;width:100%;font-size:12px}th,td{border-bottom:1px solid #e3e7ef;text-align:left;padding:9px}th{background:#f2f5f9}@media print{body{padding:0}}</style></head><body><h1>Turno del supervisor ${shift.supervisorName}</h1><p>${shift.supervisorEmail}</p><div class="summary"><div class="box">Estado<strong>${shift.status === 'closed' ? 'Cerrado' : 'En curso'}</strong></div><div class="box">Inicio<strong>${formatDate(shift.startedAt)}</strong></div><div class="box">Finalización<strong>${formatDate(shift.endedAt)}</strong></div></div><div class="box">Informes generados<strong>${reports.length}</strong></div><h2>Detalle de informes</h2><table><thead><tr><th>Asegurado</th><th>Placa</th><th>Servicio</th><th>Estado</th><th>Fecha</th></tr></thead><tbody>${rows || '<tr><td colspan="5">No se generaron informes en este turno.</td></tr>'}</tbody></table><script>window.onload=()=>window.print()</script></body></html>`)
  popup.document.close()
}

export default function Shifts() {
  const { user } = useAuth()
  const [shifts, setShifts] = React.useState<Shift[]>([])
  const [selected, setSelected] = React.useState<{ shift: Shift; reports: ShiftReport[] } | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [working, setWorking] = React.useState(false)
  const canManage = getUserRoles(user).some(role => allowedRoles.includes(role))
  const currentOpenShift = shifts.find(shift => shift.status === 'open' && shift.supervisorId === user?.id)

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

  const handleStart = async () => {
    try { setWorking(true); await startShift(user); toast.success('Turno iniciado.'); await refresh() }
    catch (error) { toast.error(error instanceof Error ? error.message : 'No se pudo iniciar el turno.') }
    finally { setWorking(false) }
  }

  const handleClose = async () => {
    if (!currentOpenShift) return
    try { setWorking(true); await closeShift(currentOpenShift.id, user); toast.success('Turno cerrado.'); await refresh() }
    catch (error) { toast.error(error instanceof Error ? error.message : 'No se pudo cerrar el turno.') }
    finally { setWorking(false) }
  }

  const showDetail = async (shift: Shift) => {
    try { setWorking(true); setSelected(await getShiftDetail(shift.id, user)) }
    catch (error) { toast.error(error instanceof Error ? error.message : 'No se pudo cargar el detalle.') }
    finally { setWorking(false) }
  }

  if (!canManage) return null

  return <main className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6">
    <header className="flex flex-col justify-between gap-4 border-b border-border pb-5 sm:flex-row sm:items-end">
      <div><p className="text-sm font-semibold uppercase tracking-widest text-primary">Operación</p><h1 className="mt-1 text-3xl font-bold tracking-tight">Inicio de turno</h1><p className="mt-2 text-muted-foreground">Registro de actividad de supervisores</p></div>
      <div className="flex gap-2"><Button variant="outline" onClick={() => void refresh()} disabled={loading}><RefreshCw className="mr-2 size-4" />Actualizar</Button>{currentOpenShift ? <Button variant="destructive" onClick={() => void handleClose()} disabled={working}><LogOut className="mr-2 size-4" />Cerrar turno</Button> : <Button onClick={() => void handleStart()} disabled={working}><LogIn className="mr-2 size-4" />Iniciar turno</Button>}</div>
    </header>

    <div className="grid gap-4 sm:grid-cols-3"><Card><CardContent className="flex items-center gap-3 pt-6"><Clock3 className="size-5 text-primary" /><div><p className="text-sm text-muted-foreground">Turno actual</p><p className="font-semibold">{currentOpenShift ? 'En curso' : 'Sin turno abierto'}</p></div></CardContent></Card><Card><CardContent className="flex items-center gap-3 pt-6"><Users className="size-5 text-sky-600" /><div><p className="text-sm text-muted-foreground">Turnos registrados</p><p className="font-semibold">{shifts.length}</p></div></CardContent></Card><Card><CardContent className="flex items-center gap-3 pt-6"><CheckCircle2 className="size-5 text-emerald-600" /><div><p className="text-sm text-muted-foreground">Total informes del turno</p><p className="font-semibold">{currentOpenShift?.reportCount ?? 0}</p></div></CardContent></Card></div>

    {currentOpenShift ? <Card><CardHeader><CardTitle>Conteo independiente del turno</CardTitle><CardDescription>Este conteo comienza al iniciar el turno y no modifica el dashboard.</CardDescription></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{shiftCategoryLabels.map(([key, label]) => <div key={key} className="rounded-lg border border-border p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-bold tabular-nums">{currentOpenShift.categoryCounts?.[key] ?? 0}</p></div>)}</CardContent></Card> : null}

    <Card><CardHeader><CardTitle>Historial de turnos</CardTitle><CardDescription>Consulta horarios, estado y cantidad de informes generados.</CardDescription></CardHeader><CardContent>{loading ? <div className="flex justify-center py-10"><Spinner /></div> : shifts.length === 0 ? <p className="py-10 text-center text-muted-foreground">Aún no hay turnos registrados.</p> : <div className="space-y-3">{shifts.map(shift => <div key={shift.id} className="flex flex-col gap-3 rounded-lg border border-border p-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">Turno del supervisor {shift.supervisorName}</h3><Badge variant={shift.status === 'closed' ? 'secondary' : 'default'}>{shift.status === 'closed' ? 'Cerrado' : 'En curso'}</Badge></div><p className="mt-1 text-sm text-muted-foreground">Inicio: {formatDate(shift.startedAt)} · Finalización: {formatDate(shift.endedAt)}</p><p className="mt-1 text-sm font-medium">{shift.reportCount} informe{shift.reportCount === 1 ? '' : 's'} generado{shift.reportCount === 1 ? '' : 's'}</p></div><div className="flex shrink-0 gap-2"><Button variant="outline" size="sm" onClick={() => void showDetail(shift)}><Eye className="mr-2 size-4" />Detalles</Button><Button variant="outline" size="sm" onClick={() => { if (selected?.shift.id === shift.id) printShift(selected.shift, selected.reports); else void getShiftDetail(shift.id, user).then(detail => printShift(detail.shift, detail.reports)) }}><Download className="mr-2 size-4" />PDF</Button></div></div>)}</div>}</CardContent></Card>

    {selected ? <Card><CardHeader><CardTitle>Detalle: Turno del supervisor {selected.shift.supervisorName}</CardTitle><CardDescription>{selected.reports.length} informe{selected.reports.length === 1 ? '' : 's'} generado{selected.reports.length === 1 ? '' : 's'} entre el inicio y el cierre.</CardDescription></CardHeader><CardContent><div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{shiftCategoryLabels.map(([key, label]) => <div key={key} className="rounded-lg border border-border p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-xl font-bold tabular-nums">{selected.shift.categoryCounts?.[key] ?? 0}</p></div>)}</div><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b border-border text-muted-foreground"><th className="p-2">Asegurado</th><th className="p-2">Placa</th><th className="p-2">Servicio</th><th className="p-2">Estado</th><th className="p-2">Fecha</th></tr></thead><tbody>{selected.reports.map(report => <tr key={report.id} className="border-b border-border"><td className="p-2">{report.insured_name}</td><td className="p-2 font-mono">{report.plate}</td><td className="p-2">{report.service_type}</td><td className="p-2">{report.status}</td><td className="p-2 whitespace-nowrap">{formatDate(report.created_at)}</td></tr>)}</tbody></table></div><Button className="mt-4" onClick={() => printShift(selected.shift, selected.reports)}><Download className="mr-2 size-4" />Descargar PDF</Button></CardContent></Card> : null}
  </main>
}
