import * as React from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { MapPin, Globe2, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

const COMPANY_LAT = 8.993388089954268
const COMPANY_LON = -79.52128668973099

interface SecurityAlert {
  id: string
  user_email?: string | null
  user_name?: string | null
  latitude?: number | null
  longitude?: number | null
  address?: string | null
  ip_address?: string | null
  status?: string | null
  distance_meters?: number | null
  created_at: string
}

interface Props {
  alert: SecurityAlert | null
  onClose: () => void
}

export function SecurityAlertMapModal({ alert, onClose }: Props) {
  if (!alert) {
    return null
  }

  return (
    <Dialog open={Boolean(alert)} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Ubicación de alerta</DialogTitle>
          <DialogDescription>
            Detalle del inicio de sesión detectado fuera del perímetro o sin ubicación.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-3xl border border-border/60 bg-muted p-4">
              <p className="text-sm font-semibold text-foreground">Usuario</p>
              <p className="mt-2 text-sm text-slate-300">{alert.user_email || alert.user_name || 'Desconocido'}</p>
              <p className="text-xs text-muted-foreground mt-3">{new Date(alert.created_at).toLocaleString('es-ES', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true,
              })}</p>
            </div>
            <div className="rounded-3xl border border-border/60 bg-muted p-4">
              <p className="text-sm font-semibold text-foreground">Estado</p>
              <Badge className="mt-2 bg-rose-500/10 text-rose-200 border-rose-500/20">{alert.status || 'Sin estado'}</Badge>
              <p className="mt-3 text-sm text-slate-300">{alert.distance_meters != null ? `${alert.distance_meters} m` : 'Sin distancia'}</p>
            </div>
          </div>

          <div className="rounded-3xl border border-border/60 bg-muted p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
              <MapPin className="size-4" /> Coordenadas
            </div>
            <p className="text-sm text-slate-300">Latitud: {alert.latitude ?? 'N/A'}</p>
            <p className="text-sm text-slate-300">Longitud: {alert.longitude ?? 'N/A'}</p>
            <p className="mt-3 text-sm text-slate-300">{alert.address || 'Dirección no disponible'}</p>
          </div>

          <div className="rounded-3xl border border-border/60 bg-muted p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
              <Globe2 className="size-4" /> Perímetro autorizado
            </div>
            <div className="space-y-2 text-sm text-slate-300">
              <p>Ubicación de la sede: Panamá</p>
              <p>Radio autorizado: 100 metros</p>
              <p>Círculo de verificación alrededor del punto de referencia.</p>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cerrar
          </Button>
          <Button asChild>
            <a href={`https://www.google.com/maps/search/?api=1&query=${alert.latitude || COMPANY_LAT},${alert.longitude || COMPANY_LON}`} target="_blank" rel="noreferrer">
              Ver en Google Maps
            </a>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
