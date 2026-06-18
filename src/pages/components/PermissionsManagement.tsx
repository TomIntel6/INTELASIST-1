import * as React from 'react'
import { PermissionsManagementService } from '@/lib/permissions-management'
import { PERMISSIONS, PERMISSION_LABELS, PERMISSION_MODULES } from '@/lib/permissions'
import type { PermissionKey } from '@/lib/permissions'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import PermissionsEditor from '@/components/PermissionsEditor'
import { DEFAULT_ROLE_PERMISSIONS } from '@/lib/permissions'
import { Spinner } from '@/components/ui/spinner'
import { toast } from 'sonner'
import { ChevronDown, ChevronUp, Save } from 'lucide-react'

interface UserWithPermissions {
  id: string
  email: string
  fullName: string
  role: string
  permissions: Record<PermissionKey, boolean>
}

export default function PermissionsManagement() {
  const [users, setUsers] = React.useState<UserWithPermissions[]>([])
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState<Record<string, boolean>>({})
  const [expandedUser, setExpandedUser] = React.useState<string | null>(null)
  const [searchTerm, setSearchTerm] = React.useState('')

  // Load users on mount
  React.useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    try {
      setLoading(true)
      
      // Backend devuelve usuarios + permisos de una vez
      const usersWithPerms = await PermissionsManagementService.getUsersWithPermissions()
      setUsers(usersWithPerms)
    } catch (error) {
      console.error('Error loading users:', error)
      toast.error('Error cargando usuarios')
    } finally {
      setLoading(false)
    }
  }

  const handlePermissionChange = (userId: string, permission: PermissionKey, granted: boolean) => {
    setUsers(prevUsers =>
      prevUsers.map(u =>
        u.id === userId
          ? {
              ...u,
              permissions: { ...u.permissions, [permission]: granted },
            }
          : u
      )
    )
  }

  const handleToggleModuleAll = (userId: string, moduleKey: string) => {
    setUsers(prevUsers =>
      prevUsers.map(u => {
        if (u.id !== userId) return u

        // Determine if we should select or deselect all
        const mk = moduleKey as keyof typeof PERMISSION_MODULES
        const modulePermissions = Object.values(PERMISSION_MODULES[mk].permissions) as PermissionKey[]
        const allSelected = modulePermissions.every((p) => u.permissions[p])

        const updatedPermissions = { ...u.permissions }
        modulePermissions.forEach((p) => {
          updatedPermissions[p] = !allSelected
        })

        return { ...u, permissions: updatedPermissions }
      })
    )
  }

  const handleSaveUser = async (userId: string) => {
    try {
      setSaving(prev => ({ ...prev, [userId]: true }))

      const user = users.find(u => u.id === userId)
      if (!user) return

      // Guardado optimista: ya tenemos los permisos en estado local.
      const oldPermissions = await PermissionsManagementService.getUserPermissions(userId)

      // Llamada API para persistir
      const success = await PermissionsManagementService.updateUserPermissions(userId, user.permissions)

      if (success) {
        toast.success('Permisos guardados. Puedes deshacer en 10s si fue un error')

        // Añadir posibilidad de deshacer durante 10s
        const timer = window.setTimeout(() => {
          // after timeout nothing to do, undo window closed
          setPendingUndo((prev) => {
            const next = { ...prev }
            delete next[userId]
            return next
          })
        }, 10000)

        setPendingUndo((prev) => ({ ...prev, [userId]: { old: oldPermissions, timer } }))
      } else {
        toast.error('Error guardando permisos')
        // revertir al estado anterior desde API
        const fresh = await PermissionsManagementService.getUserPermissions(userId)
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, permissions: fresh } : u))
      }
    } catch (error) {
      console.error('Error saving permissions:', error)
      toast.error('Error al guardar permisos')
    } finally {
      setSaving(prev => ({ ...prev, [userId]: false }))
    }
  }

  const [pendingUndo, setPendingUndo] = React.useState<Record<string, { old: Record<PermissionKey, boolean>, timer: number }>>({})

  const handleUndo = async (userId: string) => {
    const entry = pendingUndo[userId]
    if (!entry) return

    // cancelar timeout
    clearTimeout(entry.timer)

    try {
      setSaving(prev => ({ ...prev, [userId]: true }))
      const success = await PermissionsManagementService.updateUserPermissions(userId, entry.old)
      if (success) {
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, permissions: entry.old } : u))
        toast.success('Cambio revertido')
      } else {
        toast.error('No fue posible revertir los cambios')
      }
    } catch (err) {
      console.error(err)
      toast.error('Error al revertir')
    } finally {
      setSaving(prev => ({ ...prev, [userId]: false }))
      setPendingUndo(prev => {
        const next = { ...prev }
        delete next[userId]
        return next
      })
    }
  }

  const roleOptions = Object.keys(DEFAULT_ROLE_PERMISSIONS)

  const applyRoleToUser = (userId: string, roleKey: string) => {
    const rolePerms = DEFAULT_ROLE_PERMISSIONS[roleKey as keyof typeof DEFAULT_ROLE_PERMISSIONS] || []
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, permissions: Object.fromEntries((Object.keys(u.permissions) as PermissionKey[]).map(k => [k, rolePerms.includes(k)])) as Record<PermissionKey, boolean> } : u))
  }

  const filteredUsers = users.filter(u =>
    (u.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (u.fullName || '').toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Spinner className="size-6" />
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Gestión de Permisos</CardTitle>
          <CardDescription>
            Administra permisos granulares para cada usuario. Los cambios se aplican inmediatamente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
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

          <div className="space-y-2">
              {filteredUsers.length === 0 ? (
              <p className="text-sm text-slate-500 py-4 text-center">
                {searchTerm ? 'No hay usuarios que coincidan' : 'No hay usuarios'}
              </p>
            ) : (
              filteredUsers.map(user => (
                <div key={user.id} className="border rounded-lg overflow-hidden">
                  {/* User Header */}
                  <button
                    onClick={() =>
                      setExpandedUser(expandedUser === user.id ? null : user.id)
                    }
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1 text-left">
                      <div>
                        <p className="font-medium text-slate-900">{user.fullName || user.email}</p>
                        <p className="text-sm text-slate-500">{user.email}</p>
                      </div>
                      <Badge variant="outline">{user.role}</Badge>
                    </div>
                    {expandedUser === user.id ? (
                      <ChevronUp className="size-4 text-slate-500" />
                    ) : (
                      <ChevronDown className="size-4 text-slate-500" />
                    )}
                  </button>

                  {/* User Permissions: editor reutilizable + controles */}
                  {expandedUser === user.id && (
                    <div className="bg-slate-50 px-4 py-4 border-t space-y-6">
                      <div className="flex items-center gap-3">
                        <div className="flex-1">
                          <Label className="text-sm">Aplicar plantilla de rol</Label>
                          <div className="flex gap-2 mt-2">
                            <select
                              className="rounded border px-2 py-1 text-sm"
                              onChange={(e) => applyRoleToUser(user.id, e.target.value)}
                              defaultValue=""
                            >
                              <option value="">-- Seleccionar rol --</option>
                              {roleOptions.map(r => (
                                <option key={r} value={r}>{r}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div>
                          <Button onClick={() => handleSaveUser(user.id)} disabled={saving[user.id]} className="flex items-center gap-2">
                            {saving[user.id] ? (
                              <>
                                <Spinner className="size-4" />
                                Guardando...
                              </>
                            ) : (
                              <>
                                <Save className="size-4" />
                                Guardar Permisos
                              </>
                            )}
                          </Button>
                        </div>
                      </div>

                      <PermissionsEditor
                        userId={user.id}
                        permissions={user.permissions}
                        onChange={(perm, value) => handlePermissionChange(user.id, perm, value)}
                      />

                      {pendingUndo[user.id] && (
                        <div className="flex items-center justify-between bg-yellow-50 border border-yellow-200 p-3 rounded">
                          <div className="text-sm text-yellow-800">Acción aplicada recientemente.</div>
                          <div>
                            <button onClick={() => handleUndo(user.id)} className="text-sm text-yellow-800 underline">Deshacer</button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
