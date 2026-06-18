import * as React from 'react'
import { getDefaultApiBase } from '@/lib/supabase'
import { PERMISSION_MODULES } from '@/lib/permissions'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { ChevronDown, ChevronUp, Save } from 'lucide-react'
import { toast } from 'sonner'

const API_BASE = getDefaultApiBase()

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
      
      // Backend devuelve usuarios + módulos accesibles
      const response = await fetch(`${API_BASE}/api/users/with-modules`)
      if (!response.ok) throw new Error('Failed to load users')
      
      const usersData = await response.json()
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

  const handleSave = async (userId: string) => {
    try {
      setSaving((prev) => ({ ...prev, [userId]: true }))

      const user = users.find((u) => u.userId === userId)
      if (!user) return

      // Call backend to update modules
      const response = await fetch(`${API_BASE}/api/users/${userId}/modules`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modules: user.modules }),
      })
      
      if (!response.ok) throw new Error('Failed to update modules')

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('modules-changed', {
          detail: { userId, modules: user.modules, timestamp: new Date().toISOString() },
        }))
      }

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
                  {Object.entries(PERMISSION_MODULES).map(([moduleKey, moduleData]) => (
                    <div key={moduleKey} className="flex items-center gap-2">
                      <Checkbox
                        id={`${user.userId}-${moduleKey}`}
                        checked={user.modules[moduleKey] || false}
                        onCheckedChange={() => handleModuleToggle(user.userId, moduleKey)}
                      />
                      <Label htmlFor={`${user.userId}-${moduleKey}`} className="cursor-pointer text-sm">
                        {moduleData.label}
                      </Label>
                    </div>
                  ))}
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
