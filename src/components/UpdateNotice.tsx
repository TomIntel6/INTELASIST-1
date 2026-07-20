import * as React from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { APP_VERSION } from '@/lib/app-version'

const STORAGE_KEY = 'intel_last_seen_version'

export function UpdateNotice() {
  const [open, setOpen] = React.useState(false)
  const [version] = React.useState(APP_VERSION)

  React.useEffect(() => {
    try {
      const seen = localStorage.getItem(STORAGE_KEY)
      if (seen !== version) {
        // Nueva versión disponible
        setOpen(true)
      }
    } catch {
      // noop
    }
  }, [version])

  const accept = () => {
    try {
      localStorage.setItem(STORAGE_KEY, version)
    } catch {
      // noop
    }
    // Forzamos recarga completa para aplicar assets actualizados
    // Añadimos un _v timestamp para evitar cache si es necesario
    const url = new URL(window.location.href)
    url.searchParams.set('_v', String(Date.now()))
    // Cerramos modal y recargamos
    setOpen(false)
    window.location.replace(url.toString())
  }

  // Evitamos que el usuario cierre el diálogo sin aceptar.
  // onOpenChange se ignora para mantener el modal abierto hasta aceptar.
  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Nueva versión disponible</DialogTitle>
          <DialogDescription>
            Se ha lanzado la versión <strong>{version}</strong> de la plataforma.
            Debes aceptar los términos para recargar la página y ver los cambios.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 text-sm text-muted-foreground">
          <p className="mb-2">Resumen de cambios:</p>
          <ul className="list-disc pl-5">
            <li>Actualización visual y mejoras.</li>
            <li>Corrección del flujo de exportación entre Dashboard e Informes.</li>
          </ul>
        </div>

        <DialogFooter>
          <Button onClick={accept} className="ml-2">Aceptar los términos y recargar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default UpdateNotice
