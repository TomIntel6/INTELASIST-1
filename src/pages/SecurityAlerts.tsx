import * as React from 'react'
import { useSecurityAlerts } from '@/hooks/useSecurityAlerts'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Activity, AlertTriangle, Clock3, MapPin, RefreshCw, ShieldAlert, ShieldCheck } from 'lucide-react'
import { SecurityAlertMapModal } from '@/components/SecurityAlertMapModal'

export default function SecurityAlerts() {
  const { alerts, loading, error, refresh } = useSecurityAlerts(true)
  const [selectedAlert, setSelectedAlert] = React.useState<typeof alerts[number] | null>(null)
  const perimeterAlerts = alerts.filter((alert) => alert.status === 'Fuera del perímetro').length
  const missingLocationAlerts = alerts.filter((alert) => alert.latitude == null || alert.longitude == null).length

  return (
    <main className="space-y-7 px-4 py-6 lg:px-8 lg:py-8">
      <header className="flex flex-col gap-5 border-b border-border/70 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-rose-700">
            <ShieldAlert className="size-6" />
          </div>
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Centro de seguridad</p>
              <Badge variant="outline" className="gap-1.5 border-emerald-200 bg-emerald-50 text-emerald-800">
                <span className="size-1.5 rounded-full bg-emerald-500" /> Monitoreo activo
              </Badge>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Alertas de inicio de sesión</h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
              Actividad fuera del perímetro autorizado y accesos sin ubicación registrada.
            </p>
          </div>
        </div>
        <Button onClick={refresh} variant="outline" disabled={loading} className="shrink-0 gap-2 self-start sm:self-auto">
          <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Actualizando' : 'Actualizar'}
        </Button>
      </header>

      <section aria-label="Resumen de alertas" className="grid gap-3 sm:grid-cols-3">
        <div className="flex items-center gap-4 rounded-lg border border-border/70 bg-card p-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-700">
            <Activity className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">Eventos recientes</p>
            <p className="mt-0.5 text-2xl font-semibold tabular-nums text-foreground">{alerts.length}</p>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-lg border border-border/70 bg-card p-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-700">
            <ShieldAlert className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">Fuera del perímetro</p>
            <p className="mt-0.5 text-2xl font-semibold tabular-nums text-foreground">{perimeterAlerts}</p>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-lg border border-border/70 bg-card p-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
            <MapPin className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">Sin ubicación precisa</p>
            <p className="mt-0.5 text-2xl font-semibold tabular-nums text-foreground">{missingLocationAlerts}</p>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-border/70 bg-card">
        <div className="flex flex-col gap-3 border-b border-border/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold text-foreground">Registro de actividad</h2>
            <p className="mt-1 text-sm text-muted-foreground">Últimos 50 eventos de seguridad recibidos.</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock3 className="size-3.5" /> Ordenado por fecha, más reciente primero
          </div>
        </div>
          {loading ? (
            <div className="flex min-h-48 flex-col items-center justify-center gap-3 px-6 text-center text-sm text-muted-foreground">
              <RefreshCw className="size-5 animate-spin text-primary" />
              Cargando actividad de seguridad...
            </div>
          ) : error ? (
            <div className="flex min-h-48 flex-col items-center justify-center gap-3 px-6 text-center">
              <div className="flex size-10 items-center justify-center rounded-full bg-rose-50 text-rose-700">
                <AlertTriangle className="size-5" />
              </div>
              <p className="max-w-lg text-sm text-rose-800">{error}</p>
              <Button onClick={refresh} variant="outline" size="sm" className="gap-2">
                <RefreshCw className="size-3.5" /> Reintentar
              </Button>
            </div>
          ) : alerts.length === 0 ? (
            <div className="flex min-h-56 flex-col items-center justify-center gap-3 px-6 text-center">
              <div className="flex size-11 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
                <ShieldCheck className="size-5" />
              </div>
              <div>
                <p className="font-medium text-foreground">Todo en orden</p>
                <p className="mt-1 text-sm text-muted-foreground">No hay alertas de seguridad recientes.</p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[760px]">
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="pl-5">Fecha y hora</TableHead>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Ubicación detectada</TableHead>
                    <TableHead className="pr-5 text-right">Detalle</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {alerts.map((alert) => {
                    const isOutsidePerimeter = alert.status === 'Fuera del perímetro'
                    const hasCoordinates = alert.latitude != null && alert.longitude != null

                    return (
                      <TableRow key={alert.id} className="group">
                        <TableCell className="whitespace-nowrap pl-5">
                          <div className="font-medium text-foreground">{new Date(alert.created_at).toLocaleDateString('es-ES', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}</div>
                          <div className="mt-0.5 text-xs text-muted-foreground">{new Date(alert.created_at).toLocaleTimeString('es-ES', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}</div>
                        </TableCell>
                        <TableCell>
                          <div className="max-w-[15rem] truncate font-medium text-foreground">{alert.user_name || alert.user_email || 'Desconocido'}</div>
                          {alert.user_name && alert.user_email ? <div className="max-w-[15rem] truncate text-xs text-muted-foreground">{alert.user_email}</div> : null}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={isOutsidePerimeter
                            ? 'border-rose-200 bg-rose-50 text-rose-800'
                            : hasCoordinates
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                              : 'border-amber-200 bg-amber-50 text-amber-800'}>
                            <span className={`mr-1.5 size-1.5 rounded-full ${isOutsidePerimeter ? 'bg-rose-500' : hasCoordinates ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                            {alert.status || 'Sin estado'}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[18rem]">
                          <div className="truncate text-foreground">{alert.address || 'No disponible'}</div>
                          {alert.ip_address ? <div className="mt-0.5 font-mono text-xs text-muted-foreground">IP {alert.ip_address}</div> : null}
                        </TableCell>
                        <TableCell className="pr-5 text-right">
                          <Button variant="ghost" size="sm" onClick={() => setSelectedAlert(alert)} className="gap-2">
                            <MapPin className="size-4" /> Ver mapa
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
      </section>

      <SecurityAlertMapModal
        alert={selectedAlert}
        onClose={() => setSelectedAlert(null)}
      />
    </main>
  )
}
