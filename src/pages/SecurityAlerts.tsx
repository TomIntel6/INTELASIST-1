import * as React from 'react'
import { useSecurityAlerts } from '@/hooks/useSecurityAlerts'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ShieldCheck, MapPin, AlertTriangle } from 'lucide-react'
import { SecurityAlertMapModal } from '@/components/SecurityAlertMapModal'

export default function SecurityAlerts() {
  const { alerts, loading, error, refresh } = useSecurityAlerts(true)
  const [selectedAlert, setSelectedAlert] = React.useState<typeof alerts[number] | null>(null)

  return (
    <div className="space-y-6 px-4 py-6 lg:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.25em] text-muted-foreground">Seguridad</p>
          <h1 className="text-2xl font-semibold text-foreground">Alertas de inicio de sesión</h1>
          <p className="max-w-2xl text-sm leading-6 text-slate-400">
            Registros de intentos de inicio de sesión fuera del perímetro autorizado y accesos sin ubicación.
          </p>
        </div>
        <Button onClick={refresh} variant="outline">
          Actualizar
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Alertas recientes</CardTitle>
          <CardDescription>Ve los últimos 50 eventos y abre la ubicación en el mapa.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="rounded-3xl border border-dashed border-slate-700 bg-slate-950/70 p-8 text-center text-sm text-slate-400">
              Cargando alertas...
            </div>
          ) : error ? (
            <div className="rounded-3xl border border-rose-500/30 bg-rose-500/5 p-6 text-sm text-rose-200">
              <div className="flex items-center gap-2">
                <AlertTriangle className="size-4" />
                <span>{error}</span>
              </div>
            </div>
          ) : alerts.length === 0 ? (
            <div className="rounded-3xl border border-slate-700 bg-slate-950/70 p-8 text-center text-sm text-slate-400">
              No hay alertas de seguridad recientes.
            </div>
          ) : (
            <Table className="w-full">
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Dirección</TableHead>
                  <TableHead className="text-right">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {alerts.map((alert) => (
                  <TableRow key={alert.id} className="group">
                    <TableCell>{new Date(alert.created_at).toLocaleString('es-ES')}</TableCell>
                    <TableCell>{alert.user_email || alert.user_name || 'Desconocido'}</TableCell>
                    <TableCell>{alert.status || 'Sin estado'}</TableCell>
                    <TableCell className="max-w-[16rem] truncate">{alert.address || 'No disponible'}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedAlert(alert)}
                      >
                        <MapPin className="size-4 mr-2" /> Ver mapa
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <SecurityAlertMapModal
        alert={selectedAlert}
        onClose={() => setSelectedAlert(null)}
      />
    </div>
  )
}
