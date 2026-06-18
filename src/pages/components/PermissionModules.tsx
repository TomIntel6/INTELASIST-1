import * as React from 'react'
import { PERMISSION_MODULES } from '@/lib/permissions'
import { PermissionsManagementService } from '@/lib/permissions-management'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { ChevronDown, ChevronUp, Save } from 'lucide-react'
import { toast } from 'sonner'


interface UserModuleAccess {
  userId: string
  email: string
  userName: string
  role: string
  modules: Record<string, boolean>
}

export default function PermissionModules() {
  const [users, setUsers] = React.useState<UserModuleAccess[]>([])
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState<Record<string, boolean>>({})
  const [expandedUser, setExpandedUser] = React.useState<string | null>(null)
  const [searchTerm, setSearchTerm] = React.useState('')

  React.useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    try {
      setLoading(true)
      
      const usersData = await PermissionsManagementService.getUsersWithModules()
      setUsers(usersData)
    } catch (error) {
      console.error('Error loading users:', error)
      toast.error('Error cargando usuarios')
    } finally {
      setLoading(false)
    }
  }

  const handleModuleToggle = (userId: string, module: string) => {
    setUsers((prevUsers) =>
      prevUsers.map((user) =>
        user.userId === userId ? { ...user, modules: { ...user.modules, [module]: !user.modules[module] } } : user
      )
    )
  }

  const handleToggleAllModulesForUser = (userId: string) => {
    setUsers((prevUsers) =>
      prevUsers.map((user) => {
        if (user.userId !== userId) return user

        const moduleKeys = Object.keys(PERMISSION_MODULES) as Array<keyof typeof PERMISSION_MODULES>
        const allSelected = moduleKeys.every((k) => user.modules[k])

        const updatedModules: Record<string, boolean> = { ...user.modules }
        moduleKeys.forEach((k) => {
          updatedModules[k] = !allSelected
        })

        return { ...user, modules: updatedModules }
      })
    )
  }

  const handleSave = async (userId: string) => {
    try {
      setSaving((prev) => ({ ...prev, [userId]: true }))

      const user = users.find((u) => u.userId === userId)
      if (!user) return

      const success = await PermissionsManagementService.updateUserModules(userId, user.modules)

      if (!success) throw new Error('Failed to update modules')

      toast.success(`Módulos actualizados para ${user.email}`)
      // Refrescar la lista para asegurar estado consistente en la UI
      await loadUsers()
    } catch (error) {
      console.error('Error saving:', error)
      toast.error('Error guardando cambios')
    } finally {
      setSaving((prev) => ({ ...prev, [userId]: false }))
    }
  }

  const filteredUsers = users.filter(
    (user) =>
      (user.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.userName || '').toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Gestión de Módulos de Permisos</CardTitle>
          <CardDescription>Controla qué módulos pueden acceder los usuarios</CardDescription>
        </CardHeader>
        <CardContent>
          <Input
            placeholder="Buscar por email o nombre..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="mb-4"
          />
        </CardContent>
      </Card>

      <div className="space-y-3">
        {filteredUsers.map((user) => (
          <Card key={user.userId}>
            <div
              className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50"
              onClick={() =>
                setExpandedUser(expandedUser === user.userId ? null : user.userId)
              }
            >
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <div>
                    <p className="font-medium text-slate-900">{user.userName || user.email}</p>
                    <p className="text-sm text-slate-600">{user.email}</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{user.role}</Badge>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleToggleAllModulesForUser(user.userId)
                  }}
                  type="button"
                  className="text-sm text-slate-500 hover:text-slate-700 mr-2"
                >
                  Seleccionar todos
                </button>
                {expandedUser === user.userId ? (
                  <ChevronUp className="size-5 text-slate-400" />
                ) : (
                  <ChevronDown className="size-5 text-slate-400" />
                )}
              </div>
            </div>

            {expandedUser === user.userId && (
              <CardContent className="pt-0 border-t">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
                  {Object.entries(PERMISSION_MODULES).map(([moduleKey, moduleData]) => {
                    const colorMap: Record<string, string> = {
                      blue: 'bg-blue-100 text-blue-700 border-blue-200',
                      green: 'bg-green-100 text-green-700 border-green-200',
                      purple: 'bg-purple-100 text-purple-700 border-purple-200',
                      orange: 'bg-orange-100 text-orange-700 border-orange-200',
                      red: 'bg-red-100 text-red-700 border-red-200',
                      pink: 'bg-pink-100 text-pink-700 border-pink-200',
                    }

                    return (
                      <div key={moduleKey} className="flex items-center gap-2">
                        <Checkbox
                          id={`${user.userId}-${moduleKey}`}
                          checked={user.modules[moduleKey] || false}
                          onCheckedChange={() => handleModuleToggle(user.userId, moduleKey)}
                        />
                        <label htmlFor={`${user.userId}-${moduleKey}`} className="cursor-pointer text-sm inline-flex items-center gap-2">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${colorMap[(moduleData as any).color as string] || 'bg-slate-100 text-slate-700'}`}>
                            {moduleData.label}
                          </span>
                        </label>
                      </div>
                    )
                  })}
                </div>

                <div className="mt-4 flex justify-end">
                  <Button
                    onClick={() => handleSave(user.userId)}
                    disabled={saving[user.userId]}
                    className="gap-2"
                  >
                    <Save className="size-4" />
                    {saving[user.userId] ? 'Guardando...' : 'Guardar'}
                  </Button>
                </div>
              </CardContent>
            )}
          </Card>
        ))}
      </div>
    </div>
  )
}
