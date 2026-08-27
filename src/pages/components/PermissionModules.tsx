import * as React from 'react'
import { PERMISSION_MODULES } from '@/lib/permissions'
import { PermissionsManagementService } from '@/lib/permissions-management'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { ChevronDown, Save, Search } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'


interface UserModuleAccess {
  userId: string
  email: string
  userName: string
  role: string
  modules: Record<string, boolean>
}

function getInitials(name: string, email: string): string {
  const source = (name || email || '?').trim()
  const parts = source.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return source.slice(0, 2).toUpperCase()
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
          <CardTitle className="text-lg">Gestión de Módulos de Permisos</CardTitle>
          <CardDescription>Controla qué módulos pueden acceder los usuarios</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label htmlFor="module-user-search" className="text-sm font-medium">
            Buscar usuario
          </Label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
          <Input
            id="module-user-search"
            placeholder="Buscar por email o nombre..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {filteredUsers.map((user) => (
          <div
            key={user.userId}
            className={cn(
              'overflow-hidden rounded-xl border bg-card shadow-sm transition-shadow',
              expandedUser === user.userId && 'shadow-md'
            )}
          >
            <button
              type="button"
              aria-expanded={expandedUser === user.userId}
              aria-controls={`module-panel-${user.userId}`}
              className="flex w-full items-center gap-3 px-4 py-3 text-left outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset"
              onClick={() =>
                setExpandedUser(expandedUser === user.userId ? null : user.userId)
              }
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground" aria-hidden="true">
                {getInitials(user.userName, user.email)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">
                  {user.userName || user.email}
                </span>
                <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
              </span>
              <Badge variant="outline" className="shrink-0">{user.role}</Badge>
              <ChevronDown
                className={cn(
                  'size-4 shrink-0 text-muted-foreground transition-transform duration-200',
                  expandedUser === user.userId && 'rotate-180'
                )}
                aria-hidden="true"
              />
            </button>

            {expandedUser === user.userId && (
              <div id={`module-panel-${user.userId}`} className="space-y-5 border-t bg-muted/40 px-4 py-5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground">Módulos habilitados para este usuario</p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleToggleAllModulesForUser(user.userId)}
                  >
                    Seleccionar todos
                  </Button>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {Object.entries(PERMISSION_MODULES).map(([moduleKey, moduleData]) => {
                    const colorMap: Record<string, string> = {
                      blue: 'bg-blue-100 text-blue-700 border-blue-200',
                      green: 'bg-green-100 text-green-700 border-green-200',
                      purple: 'bg-purple-100 text-purple-700 border-purple-200',
                      orange: 'bg-orange-100 text-orange-700 border-orange-200',
                      red: 'bg-red-100 text-red-700 border-red-200',
                      pink: 'bg-pink-100 text-pink-700 border-pink-200',
                      teal: 'bg-teal-100 text-teal-700 border-teal-200',
                    }

                    return (
                    <div key={moduleKey} className="flex items-center justify-between gap-2 rounded-lg border bg-background px-3 py-2 shadow-sm transition-colors hover:border-primary/40">
                      <span className={`inline-flex min-w-0 items-center gap-1 rounded px-2 py-0.5 text-xs ${colorMap[(moduleData as any).color as string] || 'bg-slate-100 text-slate-700'}`}>
                        {moduleData.label}
                      </span>
                      <Switch
                        id={`${user.userId}-${moduleKey}`}
                        checked={user.modules[moduleKey] || false}
                        onCheckedChange={() => handleModuleToggle(user.userId, moduleKey)}
                      />
                    </div>
                    )
                  })}
                </div>

                <div className="flex justify-end border-t pt-4">
                  <Button
                    onClick={() => handleSave(user.userId)}
                    disabled={saving[user.userId]}
                    className="gap-2"
                  >
                    <Save className="size-4" />
                    {saving[user.userId] ? 'Guardando...' : 'Guardar'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
