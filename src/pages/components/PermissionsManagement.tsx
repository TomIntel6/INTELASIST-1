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

      const success = await PermissionsManagementService.updateUserPermissions(userId, user.permissions)

      if (success) {
        toast.success('Permisos guardados exitosamente')
        // Refrescar la lista para asegurar estado consistente
        await loadUsers()
      } else {
        toast.error('Error guardando permisos')
      }
    } catch (error) {
      console.error('Error saving permissions:', error)
      toast.error('Error al guardar permisos')
    } finally {
      setSaving(prev => ({ ...prev, [userId]: false }))
    }
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

                  {/* User Permissions */}
                  {expandedUser === user.id && (
                    <div className="bg-slate-50 px-4 py-4 border-t space-y-6">
                      {Object.entries(PERMISSION_MODULES).map(([moduleKey, module]) => {
                        const colorMap: Record<string, string> = {
                          blue: 'bg-blue-100 text-blue-700 border-blue-200',
                          green: 'bg-green-100 text-green-700 border-green-200',
                          purple: 'bg-purple-100 text-purple-700 border-purple-200',
                          orange: 'bg-orange-100 text-orange-700 border-orange-200',
                          red: 'bg-red-100 text-red-700 border-red-200',
                          pink: 'bg-pink-100 text-pink-700 border-pink-200',
                        }

                        return (
                          <div key={moduleKey}>
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="font-medium text-sm text-slate-900">
                                <span className={`inline-flex items-center gap-2 px-2 py-0.5 rounded text-xs ${colorMap[module.color as string] || 'bg-slate-100 text-slate-700'}`}>
                                  {module.label}
                                </span>
                              </h4>
                              <button
                                className="text-sm text-slate-500 hover:text-slate-700"
                                onClick={() => handleToggleModuleAll(user.id, moduleKey)}
                                type="button"
                              >
                                Seleccionar todos
                              </button>
                            </div>

                            <div className="space-y-2 ml-2">
                              {Object.entries(module.permissions).map(([permKey, permission]) => {
                                const perm = permission as PermissionKey
                                const label = PERMISSION_LABELS[perm]
                                const granted = user.permissions[perm] ?? false

                                return (
                                  <label
                                    key={perm}
                                    htmlFor={`${user.id}-${perm}`}
                                    className="flex items-center gap-2 cursor-pointer hover:bg-slate-100 px-2 py-1 rounded transition-colors"
                                  >
                                    <Checkbox
                                      id={`${user.id}-${perm}`}
                                      checked={granted}
                                      onCheckedChange={(v) => handlePermissionChange(user.id, perm, Boolean(v))}
                                    />
                                    <span className="text-sm text-slate-700">{label}</span>
                                  </label>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })}

                      {/* Save Button */}
                      <div className="flex justify-end pt-4 border-t">
                        <Button
                          onClick={() => handleSaveUser(user.id)}
                          disabled={saving[user.id]}
                          className="flex items-center gap-2"
                        >
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
