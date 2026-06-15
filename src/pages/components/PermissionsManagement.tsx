import * as React from 'react'
import { getDefaultApiBase } from '@/lib/supabase'
import { PermissionsManagementService } from '@/lib/permissions-management'

const API_BASE = getDefaultApiBase()
import { PERMISSIONS, PERMISSION_LABELS, PERMISSION_MODULES } from '@/lib/permissions'
import type { PermissionKey } from '@/lib/permissions'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
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
      const response = await fetch(`${API_BASE}/api/users/with-permissions`)
      if (!response.ok) throw new Error('Failed to load users')
      
      const usersWithPerms = await response.json()
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
    u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.fullName.toLowerCase().includes(searchTerm.toLowerCase())
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
                      {Object.entries(PERMISSION_MODULES).map(([moduleKey, module]) => (
                        <div key={moduleKey}>
                          <h4 className="font-medium text-sm text-slate-900 mb-3">
                            {module.label}
                          </h4>
                          <div className="space-y-2 ml-2">
                            {Object.entries(module.permissions).map(([permKey, permission]) => {
                              const perm = permission as PermissionKey
                              const label = PERMISSION_LABELS[perm]
                              const granted = user.permissions[perm] ?? false

                              return (
                                <label
                                  key={perm}
                                  className="flex items-center gap-2 cursor-pointer hover:bg-slate-100 px-2 py-1 rounded transition-colors"
                                >
                                  <input
                                    type="checkbox"
                                    checked={granted}
                                    onChange={(e) =>
                                      handlePermissionChange(user.id, perm, e.target.checked)
                                    }
                                    className="rounded border-slate-300"
                                  />
                                  <span className="text-sm text-slate-700">{label}</span>
                                </label>
                              )
                            })}
                          </div>
                        </div>
                      ))}

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
