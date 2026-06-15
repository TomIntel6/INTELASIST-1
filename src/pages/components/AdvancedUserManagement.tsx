import * as React from 'react'
import { UserManagementService } from '@/lib/user-management'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Lock, Unlock, AlertTriangle } from 'lucide-react'

interface UserWithActivity {
  id: string
  email: string
  fullName: string
  role: string
  reportsCreated: number
  lastLogin?: string
  lastActivity?: string
  isSuspended: boolean
  suspensionReason?: string
  suspendedAt?: string
  suspendedBy?: string
}

export default function AdvancedUserManagement() {
  const [users, setUsers] = React.useState<UserWithActivity[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [actioning, setActioning] = React.useState<Record<string, boolean>>({})
  const [stats, setStats] = React.useState<any>(null)
  const [searchTerm, setSearchTerm] = React.useState('')

  // Dialog states
  const [suspendDialog, setSuspendDialog] = React.useState<{ userId: string; email: string } | null>(null)
  const [suspendReason, setSuspendReason] = React.useState('')
  const [detailsDialog, setDetailsDialog] = React.useState<UserWithActivity | null>(null)

  React.useEffect(() => {
    loadUsers()
    loadStats()
  }, [])

  const loadUsers = async () => {
    try {
      setLoading(true)
      setError(null)
      console.log('[AdvancedUserManagement] Loading users...')
      const data = await UserManagementService.getAllUsersWithActivity()
      
      // Validate data
      if (!Array.isArray(data)) {
        throw new Error('Respuesta inválida del servidor: se esperaba un array')
      }
      
      console.log(`[AdvancedUserManagement] Loaded ${data.length} users`)
      setUsers(data)
      
      if (data.length === 0) {
        setError('No se encontraron usuarios. Verifica que el endpoint /api/users/with-activity esté disponible.')
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error)
      console.error('[AdvancedUserManagement] Error loading users:', errMsg)
      setError(`Error cargando usuarios: ${errMsg}`)
      toast.error('Error cargando usuarios')
      setUsers([])
    } finally {
      setLoading(false)
    }
  }

  const loadStats = async () => {
    try {
      const data = await UserManagementService.getActivityStatistics()
      setStats(data)
    } catch (error) {
      console.error('Error loading stats:', error)
    }
  }

  const handleSuspend = async () => {
    if (!suspendDialog || !suspendReason.trim()) {
      toast.error('Debes indicar un motivo para la suspensión')
      return
    }

    try {
      setActioning(prev => ({ ...prev, [suspendDialog.userId]: true }))
      await UserManagementService.suspendUser(suspendDialog.userId, suspendReason)
      toast.success('Usuario suspendido exitosamente')
      setSuspendDialog(null)
      setSuspendReason('')
      await loadUsers()
    } catch (error) {
      console.error('Error suspending user:', error)
      toast.error('Error suspendiendo usuario')
    } finally {
      setActioning(prev => ({ ...prev, [suspendDialog.userId]: false }))
    }
  }

  const handleReactivate = async (userId: string) => {
    try {
      setActioning(prev => ({ ...prev, [userId]: true }))
      await UserManagementService.reactivateUser(userId)
      toast.success('Usuario reactivado exitosamente')
      await loadUsers()
    } catch (error) {
      console.error('Error reactivating user:', error)
      toast.error('Error reactivando usuario')
    } finally {
      setActioning(prev => ({ ...prev, [userId]: false }))
    }
  }

  const filteredUsers = users.filter(u =>
    u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.fullName.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const formatDate = (date?: string) => {
    if (!date) return 'Nunca'
    return new Date(date).toLocaleString('es', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (loading && !users.length) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Spinner className="size-6" />
        </CardContent>
      </Card>
    )
  }

  if (error && !users.length) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
          <AlertTriangle className="size-8 text-red-600" />
          <div className="text-center">
            <p className="font-semibold text-slate-900 mb-2">Error cargando usuarios</p>
            <p className="text-sm text-slate-600 mb-4">{error}</p>
            <Button onClick={loadUsers} variant="outline" size="sm">
              Reintentar
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Statistics */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm font-medium text-slate-600 mb-1">Total de usuarios</p>
              <p className="text-3xl font-bold text-slate-900">{stats.totalUsers}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm font-medium text-slate-600 mb-1">Activos</p>
              <p className="text-3xl font-bold text-emerald-600">{stats.activeUsers}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm font-medium text-slate-600 mb-1">Suspendidos</p>
              <p className="text-3xl font-bold text-red-600">{stats.suspendedUsers}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm font-medium text-slate-600 mb-1">Promedio informes/usuario</p>
              <p className="text-3xl font-bold text-blue-600">{stats.avgReportsPerUser}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Users Card */}
      <Card>
        <CardHeader>
          <CardTitle>Gestión de Usuarios</CardTitle>
          <CardDescription>
            Administra usuarios, suspensiones y visualiza actividad
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search */}
          <div>
            <Label htmlFor="search" className="text-sm mb-2 block">
              Buscar usuario
            </Label>
            <Input
              id="search"
              placeholder="Email o nombre..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Users Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50">
                  <th className="px-4 py-2 text-left font-medium">Usuario</th>
                  <th className="px-4 py-2 text-left font-medium">Rol</th>
                  <th className="px-4 py-2 text-center font-medium">Informes</th>
                  <th className="px-4 py-2 text-left font-medium">Último acceso</th>
                  <th className="px-4 py-2 text-left font-medium">Estatus</th>
                  <th className="px-4 py-2 text-left font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map(user => (
                  <tr key={user.id} className="border-b hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-slate-900">{user.fullName || user.email}</p>
                        <p className="text-xs text-slate-500">{user.email}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline">{user.role}</Badge>
                    </td>
                    <td className="px-4 py-3 text-center text-slate-900 font-medium">
                      {user.reportsCreated}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {formatDate(user.lastLogin)}
                    </td>
                    <td className="px-4 py-3">
                      {user.isSuspended ? (
                        <Badge className="bg-red-100 text-red-800 border-red-200">
                          <Lock className="size-3 mr-1" />
                          Suspendido
                        </Badge>
                      ) : (
                        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">
                          <Unlock className="size-3 mr-1" />
                          Activo
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 space-x-2">
                      <Button
                        onClick={() => setDetailsDialog(user)}
                        variant="outline"
                        size="sm"
                      >
                        Detalles
                      </Button>
                      {user.isSuspended ? (
                        <Button
                          onClick={() => handleReactivate(user.id)}
                          disabled={actioning[user.id]}
                          variant="outline"
                          size="sm"
                          className="text-emerald-600 hover:text-emerald-700"
                        >
                          {actioning[user.id] ? <Spinner className="size-4" /> : <Unlock className="size-4" />}
                          Reactivar
                        </Button>
                      ) : (
                        <Button
                          onClick={() => setSuspendDialog({ userId: user.id, email: user.email })}
                          disabled={actioning[user.id]}
                          variant="outline"
                          size="sm"
                          className="text-red-600 hover:text-red-700"
                        >
                          {actioning[user.id] ? <Spinner className="size-4" /> : <Lock className="size-4" />}
                          Suspender
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredUsers.length === 0 && (
            <div className="text-center py-8 text-slate-500">
              {searchTerm ? 'No hay usuarios que coincidan' : 'No hay usuarios'}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Suspend Dialog */}
      <Dialog open={suspendDialog !== null} onOpenChange={(open) => {
        if (!open) {
          setSuspendDialog(null)
          setSuspendReason('')
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-red-600" />
              Suspender usuario
            </DialogTitle>
            <DialogDescription>
              {suspendDialog?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="reason" className="text-sm mb-2 block">
                Motivo de la suspensión
              </Label>
              <Textarea
                id="reason"
                placeholder="Explica el motivo de la suspensión..."
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                onClick={() => {
                  setSuspendDialog(null)
                  setSuspendReason('')
                }}
                variant="outline"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSuspend}
                disabled={!suspendReason.trim()}
                variant="destructive"
              >
                Suspender usuario
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Details Dialog */}
      <Dialog open={detailsDialog !== null} onOpenChange={(open) => {
        if (!open) setDetailsDialog(null)
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{detailsDialog?.fullName}</DialogTitle>
            <DialogDescription>{detailsDialog?.email}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-medium text-slate-600 mb-1">Rol</p>
                <Badge>{detailsDialog?.role}</Badge>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-600 mb-1">Informes creados</p>
                <p className="text-lg font-bold">{detailsDialog?.reportsCreated}</p>
              </div>
              <div className="col-span-2">
                <p className="text-xs font-medium text-slate-600 mb-1">Último acceso</p>
                <p className="text-sm">{formatDate(detailsDialog?.lastLogin)}</p>
              </div>
              <div className="col-span-2">
                <p className="text-xs font-medium text-slate-600 mb-1">Última actividad</p>
                <p className="text-sm">{formatDate(detailsDialog?.lastActivity)}</p>
              </div>
              {detailsDialog?.isSuspended && (
                <>
                  <div className="col-span-2">
                    <p className="text-xs font-medium text-red-600 mb-1">Motivo de suspensión</p>
                    <p className="text-sm text-slate-700">{detailsDialog?.suspensionReason}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs font-medium text-slate-600 mb-1">Fecha de suspensión</p>
                    <p className="text-sm">{formatDate(detailsDialog?.suspendedAt)}</p>
                  </div>
                </>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
