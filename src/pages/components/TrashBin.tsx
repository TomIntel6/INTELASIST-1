import * as React from 'react'
import { TrashService } from '@/lib/trash-service'
import type { TrashReport } from '@/lib/trash-service'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import { RotateCcw, Trash2, AlertTriangle } from 'lucide-react'

export default function TrashBin() {
  const [trash, setTrash] = React.useState<TrashReport[]>([])
  const [loading, setLoading] = React.useState(true)
  const [actioning, setActioning] = React.useState<Record<string, boolean>>({})
  const [confirmDialog, setConfirmDialog] = React.useState<{
    type: 'restore' | 'delete' | 'empty'
    trashId?: string
    reportId?: string
  } | null>(null)
  const [totalCount, setTotalCount] = React.useState(0)
  const [page, setPage] = React.useState(0)
  const limit = 10

  React.useEffect(() => {
    loadTrash()
  }, [page])

  const loadTrash = async () => {
    try {
      setLoading(true)
      const { data, count } = await TrashService.getTrash(limit, page * limit)
      setTrash(data)
      setTotalCount(count)
    } catch (error) {
      console.error('Error loading trash:', error)
      toast.error('Error cargando papelera')
    } finally {
      setLoading(false)
    }
  }

  const handleRestore = async (trashId: string) => {
    try {
      setActioning(prev => ({ ...prev, [trashId]: true }))
      await TrashService.restoreReport(trashId)
      toast.success('Informe restaurado exitosamente')
      await loadTrash()
    } catch (error) {
      console.error('Error restoring report:', error)
      toast.error('Error restaurando informe')
    } finally {
      setActioning(prev => ({ ...prev, [trashId]: false }))
    }
  }

  const handlePermanentDelete = async (trashId: string) => {
    try {
      setActioning(prev => ({ ...prev, [trashId]: true }))
      await TrashService.permanentlyDelete(trashId)
      toast.success('Informe eliminado permanentemente')
      await loadTrash()
    } catch (error) {
      console.error('Error deleting report:', error)
      toast.error('Error eliminando informe')
    } finally {
      setActioning(prev => ({ ...prev, [trashId]: false }))
    }
  }

  const handleEmptyTrash = async () => {
    try {
      setLoading(true)
      const result = await TrashService.emptyTrash()
      toast.success(`${result.count} informe(s) eliminado(s) permanentemente`)
      await loadTrash()
    } catch (error) {
      console.error('Error emptying trash:', error)
      toast.error('Error vaciando papelera')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('es', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const totalPages = Math.ceil(totalCount / limit)

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Papelera de Informes</CardTitle>
              <CardDescription>
                Informes eliminados pueden ser restaurados o eliminados permanentemente.
              </CardDescription>
            </div>
            {totalCount > 0 && (
              <Button
                onClick={() => setConfirmDialog({ type: 'empty' })}
                disabled={loading}
                variant="destructive"
                className="flex items-center gap-2"
              >
                <Trash2 className="size-4" />
                Vaciar Papelera
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
              <p className="text-sm font-medium text-amber-900">Total en papelera</p>
              <p className="text-2xl font-bold text-amber-700">{totalCount}</p>
            </div>
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
              <p className="text-sm font-medium text-slate-900">Página actual</p>
              <p className="text-2xl font-bold text-slate-700">{page + 1} / {Math.max(1, totalPages)}</p>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <p className="text-sm font-medium text-blue-900">Mostrando</p>
              <p className="text-2xl font-bold text-blue-700">{trash.length}</p>
            </div>
          </div>

          {/* Loading State */}
          {loading && !trash.length ? (
            <div className="flex items-center justify-center py-8">
              <Spinner className="size-6" />
            </div>
          ) : null}

          {/* Empty State */}
          {!loading && trash.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Trash2 className="size-12 mx-auto mb-4 opacity-20" />
              <p className="font-medium">La papelera está vacía</p>
              <p className="text-sm">Los informes eliminados aparecerán aquí</p>
            </div>
          ) : null}

          {/* Trash Items */}
          <div className="space-y-2">
            {trash.map(item => (
              <div key={item.id} className="border rounded-lg p-4 hover:bg-slate-50 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                        Eliminado
                      </Badge>
                      {item.reason && (
                        <p className="text-xs text-slate-500">{item.reason}</p>
                      )}
                    </div>
                    <p className="font-medium text-slate-900">
                      Informe: {item.originalData?.plate || item.reportId}
                    </p>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-600">
                      <div>
                        <p className="font-medium text-slate-700">Propietario original:</p>
                        <p>{item.originalData?.created_by_name || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="font-medium text-slate-700">Eliminado por:</p>
                        <p>{item.deletedByName || item.deletedByEmail || 'Sistema'}</p>
                      </div>
                      <div>
                        <p className="font-medium text-slate-700">Fecha de eliminación:</p>
                        <p>{formatDate(item.deletedAt)}</p>
                      </div>
                      <div>
                        <p className="font-medium text-slate-700">Correo de eliminación:</p>
                        <p>{item.deletedByEmail || 'N/A'}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => setConfirmDialog({
                        type: 'restore',
                        trashId: item.id,
                        reportId: item.reportId,
                      })}
                      disabled={actioning[item.id]}
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-2"
                    >
                      {actioning[item.id] ? (
                        <Spinner className="size-4" />
                      ) : (
                        <RotateCcw className="size-4" />
                      )}
                      Restaurar
                    </Button>
                    <Button
                      onClick={() => setConfirmDialog({
                        type: 'delete',
                        trashId: item.id,
                        reportId: item.reportId,
                      })}
                      disabled={actioning[item.id]}
                      variant="destructive"
                      size="sm"
                      className="flex items-center gap-2"
                    >
                      {actioning[item.id] ? (
                        <Spinner className="size-4" />
                      ) : (
                        <Trash2 className="size-4" />
                      )}
                      Eliminar
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t">
              <div className="text-sm text-slate-600">
                Página {page + 1} de {totalPages}
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => setPage(Math.max(0, page - 1))}
                  disabled={page === 0 || loading}
                  variant="outline"
                  size="sm"
                >
                  Anterior
                </Button>
                <Button
                  onClick={() => setPage(page + 1)}
                  disabled={page >= totalPages - 1 || loading}
                  variant="outline"
                  size="sm"
                >
                  Siguiente
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirm Dialogs */}
      <AlertDialog open={confirmDialog !== null} onOpenChange={(open) => {
        if (!open) setConfirmDialog(null)
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-amber-600" />
              {confirmDialog?.type === 'restore'
                ? 'Restaurar informe'
                : confirmDialog?.type === 'delete'
                  ? 'Eliminar permanentemente'
                  : 'Vaciar papelera'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDialog?.type === 'restore'
                ? 'El informe será restaurado y volverá a estar disponible en la lista de informes.'
                : confirmDialog?.type === 'delete'
                  ? 'Esta acción no se puede deshacer. El informe será eliminado permanentemente.'
                  : 'Todos los informes en la papelera serán eliminados permanentemente. Esta acción no se puede deshacer.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={async () => {
              try {
                if (!confirmDialog) return
                if (confirmDialog.type === 'restore' && confirmDialog.trashId) {
                  await handleRestore(confirmDialog.trashId)
                } else if (confirmDialog.type === 'delete' && confirmDialog.trashId) {
                  await handlePermanentDelete(confirmDialog.trashId)
                } else if (confirmDialog.type === 'empty') {
                  await handleEmptyTrash()
                }
              } catch (error) {
                console.error('Error executing trash action:', error)
                toast.error('Error procesando la acción. Intenta nuevamente.')
              } finally {
                setConfirmDialog(null)
              }
            }}
            className={confirmDialog?.type !== 'restore' ? 'bg-destructive hover:bg-destructive/90' : ''}
          >
            {confirmDialog?.type === 'restore'
              ? 'Restaurar'
              : confirmDialog?.type === 'delete'
                ? 'Eliminar permanentemente'
                : 'Vaciar papelera'}
          </AlertDialogAction>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
