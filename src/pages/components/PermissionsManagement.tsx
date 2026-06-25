import * as React from 'react'
import { PermissionsManagementService } from '@/lib/permissions-management'
import { getAllPermissionKeys, PERMISSION_MODULES } from '@/lib/permissions'
import type { ModuleKey, PermissionKey } from '@/lib/permissions'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import PermissionsEditor from '@/components/PermissionsEditor'
import { DEFAULT_ROLE_PERMISSIONS } from '@/lib/permissions'
import { Spinner } from '@/components/ui/spinner'
import { toast } from 'sonner'
import { ChevronDown, Save, Search, Undo2, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getUserRoles, useAuth } from '@/lib/auth'

interface UserWithPermissions {
  id: string
  email: string
  fullName: string
  role: string
  presenceStyle: string
  permissions: Record<PermissionKey, boolean>
}

interface UserWithPermissionsPayload {
  id?: string
  email?: string
  fullName?: string
  role?: string
  presenceStyle?: string
  permissions?: Record<string, unknown>
}

interface Baseline {
  permissions: Record<PermissionKey, boolean>
  presenceStyle: string
}

const ALL_PERMISSION_KEYS = getAllPermissionKeys()

const presenceStyleOptions = [
  { value: 'none', label: 'Sin animación' },
  { value: 'glow', label: 'Brillo' },
  { value: 'pulse', label: 'Pulso' },
  { value: 'rainbow', label: 'Arcoíris' },
  { value: 'orbit', label: 'Orbital' },
  { value: 'wave', label: 'Ola' },
  { value: 'aurora', label: 'Aurora' },
  { value: 'spectrum', label: 'Espectro' },
  { value: 'neon', label: 'Neón' },
  { value: 'haze', label: 'Haze' },
  { value: 'prism', label: 'Prisma' },
  { value: 'loopwave', label: 'Ola de borde' },
]

function getInitials(name: string, email: string): string {
  const source = (name || email || '?').trim()
  const parts = source.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return source.slice(0, 2).toUpperCase()
}

export default function PermissionsManagement() {
  const [users, setUsers] = React.useState<UserWithPermissions[]>([])
  const [baseline, setBaseline] = React.useState<Record<string, Baseline>>({})
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState<Record<string, boolean>>({})
  const [expandedUser, setExpandedUser] = React.useState<string | null>(null)
  const [searchTerm, setSearchTerm] = React.useState('')
  const [pendingUndo, setPendingUndo] = React.useState<
    Record<string, { old: Record<PermissionKey, boolean>; timer: number }>
  >({})
  const { user } = useAuth()
  const canAssignPresenceStyles = React.useMemo(() => getUserRoles(user).includes('Support'), [user])

  React.useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    try {
      setLoading(true)
      const usersWithPerms = await PermissionsManagementService.getUsersWithPermissions()
      const mapped = usersWithPerms.map((u: UserWithPermissionsPayload) => ({
        id: u.id || '',
        email: u.email || '',
        fullName: u.fullName || '',
        role: u.role || '',
        presenceStyle: u.presenceStyle || 'none',
        permissions: (u.permissions || {}) as Record<PermissionKey, boolean>,
      }))
      setUsers(mapped)
      // Snapshot para detectar cambios sin guardar.
      setBaseline(
        Object.fromEntries(
          mapped.map((u) => [u.id, { permissions: { ...u.permissions }, presenceStyle: u.presenceStyle }])
        )
      )
    } catch (error) {
      console.error('Error loading users:', error)
      toast.error('Error cargando usuarios')
    } finally {
      setLoading(false)
    }
  }

  const handlePermissionChange = (userId: string, permission: PermissionKey, granted: boolean) => {
    setUsers((prev) =>
      prev.map((u) =>
        u.id === userId ? { ...u, permissions: { ...u.permissions, [permission]: granted } } : u
      )
    )
  }

  const handleToggleModule = (userId: string, moduleKey: ModuleKey, nextValue: boolean) => {
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id !== userId) return u
        const modulePerms = Object.values(PERMISSION_MODULES[moduleKey].permissions) as PermissionKey[]
        const updated = { ...u.permissions }
        modulePerms.forEach((p) => {
          updated[p] = nextValue
        })
        return { ...u, permissions: updated }
      })
    )
  }

  const applyRoleToUser = (userId: string, roleKey: string) => {
    if (!roleKey) return
    const rolePerms = DEFAULT_ROLE_PERMISSIONS[roleKey as keyof typeof DEFAULT_ROLE_PERMISSIONS] || []
    setUsers((prev) =>
      prev.map((u) =>
        u.id === userId
          ? {
              ...u,
              permissions: Object.fromEntries(
                ALL_PERMISSION_KEYS.map((k) => [k, rolePerms.includes(k)])
              ) as Record<PermissionKey, boolean>,
            }
          : u
      )
    )
    toast.message(`Plantilla "${roleKey}" aplicada`, {
      description: 'Revisa los permisos y pulsa Guardar para confirmar.',
    })
  }

  const handlePresenceStyleChange = (userId: string, presenceStyle: string) => {
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, presenceStyle } : u)))
  }

  const isDirty = React.useCallback(
    (u: UserWithPermissions) => {
      const base = baseline[u.id]
      if (!base) return false
      const permsDirty = ALL_PERMISSION_KEYS.some(
        (k) => Boolean(base.permissions[k]) !== Boolean(u.permissions[k])
      )
      const presenceDirty = (base.presenceStyle || 'none') !== (u.presenceStyle || 'none')
      return permsDirty || presenceDirty
    },
    [baseline]
  )

  const handleDiscard = (userId: string) => {
    const base = baseline[userId]
    if (!base) return
    setUsers((prev) =>
      prev.map((u) =>
        u.id === userId
          ? { ...u, permissions: { ...base.permissions }, presenceStyle: base.presenceStyle }
          : u
      )
    )
    toast.message('Cambios descartados')
  }

  const handleSaveUser = async (userId: string) => {
    try {
      setSaving((prev) => ({ ...prev, [userId]: true }))
      const target = users.find((u) => u.id === userId)
      if (!target) return

      const oldPermissions = await PermissionsManagementService.getUserPermissions(userId)
      const success = await PermissionsManagementService.updateUserPermissions(
        userId,
        target.permissions,
        target.presenceStyle
      )

      if (success) {
        // Actualizar snapshot: ya no hay cambios pendientes.
        setBaseline((prev) => ({
          ...prev,
          [userId]: { permissions: { ...target.permissions }, presenceStyle: target.presenceStyle },
        }))

        toast.success('Permisos guardados', {
          description: 'Puedes deshacer el cambio durante 10 segundos.',
          action: { label: 'Deshacer', onClick: () => handleUndo(userId) },
        })

        const timer = window.setTimeout(() => {
          setPendingUndo((prev) => {
            const next = { ...prev }
            delete next[userId]
            return next
          })
        }, 10000)
        setPendingUndo((prev) => ({ ...prev, [userId]: { old: oldPermissions, timer } }))
      } else {
        toast.error('Error guardando permisos')
        const fresh = await PermissionsManagementService.getUserPermissions(userId)
        setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, permissions: fresh } : u)))
      }
    } catch (error) {
      console.error('Error saving permissions:', error)
      toast.error('Error al guardar permisos')
    } finally {
      setSaving((prev) => ({ ...prev, [userId]: false }))
    }
  }

  const handleUndo = async (userId: string) => {
    const entry = pendingUndo[userId]
    if (!entry) return
    clearTimeout(entry.timer)
    try {
      setSaving((prev) => ({ ...prev, [userId]: true }))
      const success = await PermissionsManagementService.updateUserPermissions(userId, entry.old)
      if (success) {
        setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, permissions: entry.old } : u)))
        setBaseline((prev) => ({
          ...prev,
          [userId]: {
            permissions: { ...entry.old },
            presenceStyle: prev[userId]?.presenceStyle ?? 'none',
          },
        }))
        toast.success('Cambio revertido')
      } else {
        toast.error('No fue posible revertir los cambios')
      }
    } catch (err) {
      console.error(err)
      toast.error('Error al revertir')
    } finally {
      setSaving((prev) => ({ ...prev, [userId]: false }))
      setPendingUndo((prev) => {
        const next = { ...prev }
        delete next[userId]
        return next
      })
    }
  }

  const roleOptions = Object.keys(DEFAULT_ROLE_PERMISSIONS)

  const filteredUsers = users.filter(
    (u) =>
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
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Gestión de Permisos</CardTitle>
          <CardDescription>
            Administra permisos granulares por usuario. Los cambios se aplican al pulsar Guardar.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* ── Buscador ── */}
          <div className="space-y-2">
            <Label htmlFor="search" className="text-sm font-medium">
              Buscar usuario
            </Label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                id="search"
                placeholder="Email o nombre…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* ── Lista de usuarios ── */}
          <div className="space-y-3">
            {filteredUsers.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {searchTerm ? 'No hay usuarios que coincidan' : 'No hay usuarios'}
              </p>
            ) : (
              filteredUsers.map((u) => {
                const expanded = expandedUser === u.id
                const dirty = isDirty(u)
                const activeCount = ALL_PERMISSION_KEYS.filter((k) => u.permissions[k]).length
                const totalCount = ALL_PERMISSION_KEYS.length
                const panelId = `user-panel-${u.id}`

                return (
                  <div
                    key={u.id}
                    className={cn(
                      'overflow-hidden rounded-xl border bg-card shadow-sm transition-shadow',
                      expanded && 'shadow-md'
                    )}
                  >
                    {/* ── Cabecera de usuario ── */}
                    <button
                      type="button"
                      onClick={() => setExpandedUser(expanded ? null : u.id)}
                      aria-expanded={expanded}
                      aria-controls={panelId}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset"
                    >
                      <span
                        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground"
                        aria-hidden="true"
                      >
                        {getInitials(u.fullName, u.email)}
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-foreground">
                          {u.fullName || u.email}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">{u.email}</span>
                      </span>

                      {dirty && (
                        <Badge className="border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-400">
                          Sin guardar
                        </Badge>
                      )}
                      <Badge variant="outline" className="shrink-0">
                        {u.role}
                      </Badge>

                      <ChevronDown
                        className={cn(
                          'size-4 shrink-0 text-muted-foreground transition-transform duration-200',
                          expanded && 'rotate-180'
                        )}
                        aria-hidden="true"
                      />
                    </button>

                    {/* ── Panel expandible ── */}
                    {expanded && (
                      <div id={panelId} className="space-y-6 border-t bg-muted/40 px-4 py-5">
                        {/* Acciones secundarias: atajos de configuración */}
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-1.5">
                            <Label className="text-sm font-medium" htmlFor={`tpl-${u.id}`}>
                              Aplicar plantilla de rol
                            </Label>
                            <NativeSelect
                              id={`tpl-${u.id}`}
                              className="w-full"
                              defaultValue=""
                              onChange={(e) => {
                                applyRoleToUser(u.id, e.target.value)
                                e.target.value = ''
                              }}
                            >
                              <NativeSelectOption value="" disabled>
                                Elegir plantilla…
                              </NativeSelectOption>
                              {roleOptions.map((r) => (
                                <NativeSelectOption key={r} value={r}>
                                  {r}
                                </NativeSelectOption>
                              ))}
                            </NativeSelect>
                            <p className="text-xs text-muted-foreground">
                              Reemplaza los permisos con los del rol seleccionado.
                            </p>
                          </div>

                          <div className="space-y-1.5">
                            <Label className="text-sm font-medium" htmlFor={`presence-${u.id}`}>
                              Animación en conectados
                            </Label>
                            {canAssignPresenceStyles ? (
                              <>
                                <NativeSelect
                                  id={`presence-${u.id}`}
                                  className="w-full"
                                  value={u.presenceStyle || 'none'}
                                  onChange={(e) => handlePresenceStyleChange(u.id, e.target.value)}
                                >
                                  {presenceStyleOptions.map((option) => (
                                    <NativeSelectOption key={option.value} value={option.value}>
                                      {option.label}
                                    </NativeSelectOption>
                                  ))}
                                </NativeSelect>
                                <p className="text-xs text-muted-foreground">
                                  Se mostrará en el panel “Conectados”.
                                </p>
                              </>
                            ) : (
                              <div className="flex h-9 items-center rounded-md border border-dashed px-3 text-xs text-muted-foreground">
                                Solo el rol Support puede asignarla
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Editor de permisos por categoría */}
                        <PermissionsEditor
                          userId={u.id}
                          permissions={u.permissions}
                          onChange={(perm, value) => handlePermissionChange(u.id, perm, value)}
                          onToggleModule={(moduleKey, nextValue) =>
                            handleToggleModule(u.id, moduleKey, nextValue)
                          }
                        />

                        {/* ── Barra de acción: resumen + guardado primario ── */}
                        <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
                          <p className="text-xs text-muted-foreground">
                            <span className="font-semibold text-foreground tabular-nums">{activeCount}</span> de{' '}
                            <span className="tabular-nums">{totalCount}</span> permisos activos
                            {dirty && <span className="ml-2 text-amber-600 dark:text-amber-400">· cambios sin guardar</span>}
                          </p>

                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              disabled={!dirty || saving[u.id]}
                              onClick={() => handleDiscard(u.id)}
                            >
                              <RotateCcw className="size-4" />
                              Descartar
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              disabled={!dirty || saving[u.id]}
                              onClick={() => handleSaveUser(u.id)}
                            >
                              {saving[u.id] ? (
                                <>
                                  <Spinner className="size-4" />
                                  Guardando…
                                </>
                              ) : (
                                <>
                                  <Save className="size-4" />
                                  Guardar permisos
                                </>
                              )}
                            </Button>
                          </div>
                        </div>

                        {pendingUndo[u.id] && (
                          <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 dark:border-amber-500/30 dark:bg-amber-500/10">
                            <span className="text-xs text-amber-800 dark:text-amber-300">
                              Cambios aplicados recientemente.
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="xs"
                              onClick={() => handleUndo(u.id)}
                              className="text-amber-800 hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-500/20"
                            >
                              <Undo2 className="size-3" />
                              Deshacer
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
