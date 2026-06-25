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
import { Lock, Unlock, AlertTriangle, Users, ShieldCheck, ShieldOff, FileText, Search } from 'lucide-react'

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

  // Rellena reportsCreated llamando por usuario en caso de que falte el campo
  const fillMissingReportCounts = async (loadedUsers: UserWithActivity[]) => {
    try {
      const missing = loadedUsers.filter(u => u.reportsCreated === undefined || u.reportsCreated === null)
      if (missing.length === 0) return

      const results = await Promise.all(missing.map(u => UserManagementService.getUserActivity(u.id)))

      setUsers(prev => prev.map(p => {
        const found = results.find(r => r && String(r.id) === String(p.id))
        if (found && typeof found.reportsCreated !== 'undefined') {
          return { ...p, reportsCreated: Number(found.reportsCreated || 0) }
        }
        return p
      }))
    } catch (err) {
      console.error('[AdvancedUserManagement] Error rellenando reportsCreated:', err)
    }
  }

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
      // Si algunos usuarios no traen el conteo, rellenar haciendo llamadas por usuario
      void fillMissingReportCounts(data)
      
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
      toast.error(error instanceof Error ? error.message : 'Error suspendiendo usuario')
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
      toast.error(error instanceof Error ? error.message : 'Error reactivando usuario')
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
        <CardContent className="flex flex-col items-center justify-center gap-4 py-12">
          <span className="flex size-12 items-center justify-center rounded-xl bg-red-500/10 text-red-600 ring-1 ring-red-500/20 dark:text-red-400">
            <AlertTriangle className="size-6" />
          </span>
          <div className="text-center">
            <p className="mb-2 font-semibold text-foreground">Error cargando usuarios</p>
            <p className="mb-4 text-sm text-muted-foreground">{error}</p>
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
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600 ring-1 ring-sky-500/20 dark:text-sky-400">
                <Users className="size-5" />
              </span>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Total de usuarios</p>
            </div>
            <p className="mt-3 text-3xl font-bold tabular-nums text-foreground">{stats.totalUsers}</p>
          </div>
          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 ring-1 ring-emerald-500/20 dark:text-emerald-400">
                <ShieldCheck className="size-5" />
              </span>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Activos</p>
            </div>
            <p className="mt-3 text-3xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{stats.activeUsers}</p>
          </div>
          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-red-500/10 text-red-600 ring-1 ring-red-500/20 dark:text-red-400">
                <ShieldOff className="size-5" />
              </span>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Suspendidos</p>
            </div>
            <p className="mt-3 text-3xl font-bold tabular-nums text-red-600 dark:text-red-400">{stats.suspendedUsers}</p>
          </div>
          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 ring-1 ring-blue-500/20 dark:text-blue-400">
                <FileText className="size-5" />
              </span>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Promedio informes/usuario</p>
            </div>
            <p className="mt-3 text-3xl font-bold tabular-nums text-blue-600 dark:text-blue-400">{stats.avgReportsPerUser}</p>
          </div>
        </div>
      )}

      {/* Users Card */}
      <Card className="relative overflow-hidden">
        <span className="brand-gradient-bg absolute inset-x-0 top-0 h-1 opacity-80" aria-hidden="true" />
        <CardHeader>
          <p className="mb-1.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            <span className="brand-gradient-bg size-1.5 rounded-full" aria-hidden="true" />
            Usuarios
          </p>
          <CardTitle>Gestión de Usuarios</CardTitle>
          <CardDescription>
            Administra usuarios, suspensiones y visualiza actividad
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search */}
          <div>
            <Label htmlFor="search" className="mb-2 block text-sm font-medium">
              Buscar usuario
            </Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                id="search"
                placeholder="Email o nombre..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* Users Table */}
          <div className="overflow-hidden rounded-xl border">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Usuario</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Rol</th>
                    <th className="px-4 py-2.5 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">Informes</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Último acceso</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Estatus</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map(user => (
                    <tr key={user.id} className="border-b border-border transition-colors last:border-b-0 hover:bg-accent">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-foreground">{user.fullName || user.email}</p>
                          <p className="text-xs text-muted-foreground">{user.email}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline">{user.role}</Badge>
                      </td>
                      <td className="px-4 py-3 text-center font-medium tabular-nums text-foreground">
                        {user.reportsCreated}
                      </td>
                      <td className="px-4 py-3 text-xs tabular-nums text-muted-foreground">
                        {formatDate(user.lastLogin)}
                      </td>
                      <td className="px-4 py-3">
                        {user.isSuspended ? (
                          <Badge className="border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400">
                            <Lock className="mr-1 size-3" />
                            Suspendido
                          </Badge>
                        ) : (
                          <Badge className="border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                            <Unlock className="mr-1 size-3" />
                            Activo
                          </Badge>
                        )}
                      </td>
                      <td className="space-x-2 px-4 py-3">
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
                            className="text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
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
                            className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
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
              <div className="py-8 text-center text-sm text-muted-foreground">
                {searchTerm ? 'No hay usuarios que coincidan' : 'No hay usuarios'}
              </div>
            )}
          </div>
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
              <span className="flex size-8 items-center justify-center rounded-lg bg-red-500/10 text-red-600 ring-1 ring-red-500/20 dark:text-red-400">
                <AlertTriangle className="size-4" />
              </span>
              Suspender usuario
            </DialogTitle>
            <DialogDescription>
              {suspendDialog?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="reason" className="mb-2 block text-sm font-medium">
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
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Rol</p>
                <Badge>{detailsDialog?.role}</Badge>
              </div>
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Informes creados</p>
                <p className="text-lg font-bold tabular-nums text-foreground">{detailsDialog?.reportsCreated}</p>
              </div>
              <div className="col-span-2">
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Último acceso</p>
                <p className="text-sm tabular-nums text-foreground">{formatDate(detailsDialog?.lastLogin)}</p>
              </div>
              <div className="col-span-2">
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Última actividad</p>
                <p className="text-sm tabular-nums text-foreground">{formatDate(detailsDialog?.lastActivity)}</p>
              </div>
              {detailsDialog?.isSuspended && (
                <>
                  <div className="col-span-2 rounded-lg border border-red-500/20 bg-red-500/10 p-3">
                    <p className="mb-1 text-xs font-medium uppercase tracking-wide text-red-600 dark:text-red-400">Motivo de suspensión</p>
                    <p className="text-sm text-foreground">{detailsDialog?.suspensionReason}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Fecha de suspensión</p>
                    <p className="text-sm tabular-nums text-foreground">{formatDate(detailsDialog?.suspendedAt)}</p>
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
