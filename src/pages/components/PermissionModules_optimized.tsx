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

interface UserModuleCardProps {
  user: UserModuleAccess
  isExpanded: boolean
  isSaving: boolean
  onToggleExpand: () => void
  onModuleToggle: (module: string) => void
  onSave: () => void
}

// Memoized user module card component
const UserModuleCard = React.memo(function UserModuleCard({
  user,
  isExpanded,
  isSaving,
  onToggleExpand,
  onModuleToggle,
  onSave,
}: UserModuleCardProps) {
  return (
    <Card>
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50"
        onClick={onToggleExpand}
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
          {isExpanded ? (
            <ChevronUp className="size-5 text-slate-400" />
          ) : (
            <ChevronDown className="size-5 text-slate-400" />
          )}
        </div>
      </div>

      {isExpanded && (
        <CardContent className="pt-0 border-t">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
            {Object.entries(PERMISSION_MODULES).map(([moduleKey, moduleData]) => (
              <div key={moduleKey} className="flex items-center gap-2">
                <Checkbox
                  id={`${user.userId}-${moduleKey}`}
                  checked={user.modules[moduleKey] || false}
                  onCheckedChange={() => onModuleToggle(moduleKey)}
                />
                <Label htmlFor={`${user.userId}-${moduleKey}`} className="cursor-pointer text-sm">
                  {moduleData.label}
                </Label>
              </div>
            ))}
          </div>

          <div className="mt-4 flex justify-end">
            <Button
              onClick={onSave}
              disabled={isSaving}
              className="gap-2"
            >
              <Save className="size-4" />
              {isSaving ? 'Guardando...' : 'Guardar'}
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  )
}, (prevProps, nextProps) => {
  // Custom comparison for better memoization
  return (
    prevProps.user.userId === nextProps.user.userId &&
    prevProps.isExpanded === nextProps.isExpanded &&
    prevProps.isSaving === nextProps.isSaving &&
    JSON.stringify(prevProps.user.modules) === JSON.stringify(nextProps.user.modules)
  )
})

export default function PermissionModules() {
  const [users, setUsers] = React.useState<UserModuleAccess[]>([])
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState<Record<string, boolean>>({})
  const [expandedUser, setExpandedUser] = React.useState<string | null>(null)
  const [searchTerm, setSearchTerm] = React.useState('')

  React.useEffect(() => {
    loadUsers()
  }, [])

  // Escuchar cambios de módulos en tiempo real desde el backend
  React.useEffect(() => {
    const handleModulesChanged = (event: Event) => {
      const customEvent = event as CustomEvent
      const payload = customEvent.detail
      console.log('[Real-time] Módulos actualizados:', payload)
      
      if (payload?.userId) {
        loadUsers()
        toast.success(`Módulos actualizados en tiempo real para el usuario`)
      }
    }

    window.addEventListener('modules-changed', handleModulesChanged)
    
    return () => {
      window.removeEventListener('modules-changed', handleModulesChanged)
    }
  }, [])

  const loadUsers = React.useCallback(async () => {
    try {
      setLoading(true)
      
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
  }, [])

  const handleModuleToggle = React.useCallback((userId: string, module: string) => {
    setUsers((prevUsers) =>
      prevUsers.map((user) =>
        user.userId === userId ? { ...user, modules: { ...user.modules, [module]: !user.modules[module] } } : user
      )
    )
  }, [])

  const handleSave = React.useCallback(async (userId: string) => {
    try {
      setSaving((prev) => ({ ...prev, [userId]: true }))

      const user = users.find((u) => u.userId === userId)
      if (!user) return

      const response = await fetch(`${API_BASE}/api/users/${userId}/modules`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modules: user.modules }),
      })
      
      if (!response.ok) throw new Error('Failed to update modules')

      toast.success(`Módulos actualizados para ${user.email}`)
      await loadUsers()
    } catch (error) {
      console.error('Error saving:', error)
      toast.error('Error guardando cambios')
    } finally {
      setSaving((prev) => ({ ...prev, [userId]: false }))
    }
  }, [users])

  const filteredUsers = React.useMemo(() =>
    users.filter(
      (user) =>
        (user.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (user.userName || '').toLowerCase().includes(searchTerm.toLowerCase())
    ),
    [users, searchTerm]
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
          <UserModuleCard
            key={user.userId}
            user={user}
            isExpanded={expandedUser === user.userId}
            isSaving={saving[user.userId] || false}
            onToggleExpand={() => setExpandedUser(expandedUser === user.userId ? null : user.userId)}
            onModuleToggle={(module) => handleModuleToggle(user.userId, module)}
            onSave={() => handleSave(user.userId)}
          />
        ))}
      </div>
    </div>
  )
}
