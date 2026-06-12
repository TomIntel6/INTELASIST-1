import * as React from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { canAssignSupportRole, canCreateUsers, canDeleteUsers, canManageAgents, canViewPasswords, fetchOnlineUsersFromServer, getNameColorClasses, useAuth, USERS_SYNC_STORAGE_KEY, type UserRole } from '@/lib/auth'

interface Usuario {
  id: number
  nombre?: string | null
  correo?: string | null
  estado?: 'Activo' | 'Desconectado'
}

const ROLE_OPTIONS: UserRole[] = ['Agente', 'Admin', 'Support', 'Gerente']
const getDefaultApiBase = () => {
  if (import.meta.env.VITE_API_BASE_URL) return import.meta.env.VITE_API_BASE_URL
  return 'https://intelasist.onrender.com'
}
const API_BASE_URL = getDefaultApiBase()
const USERS_CACHE_KEY = 'intelasist-users-cache-v1'

function sanitizeUsuario(value: unknown): Usuario | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const record = value as Record<string, unknown>
  const rawId = Number(record.id)
  const correo = typeof record.correo === 'string' ? record.correo.trim() : ''
  const nombre = typeof record.nombre === 'string' ? record.nombre.trim() : ''

  if (!correo && !Number.isFinite(rawId)) {
    return null
  }

  return {
    id: Number.isFinite(rawId) && rawId > 0 ? rawId : Date.now(),
    nombre: nombre || correo,
    correo,
    estado: record.estado === 'Activo' ? 'Activo' : 'Desconectado',
  }
}

function loadCachedUsuarios(): Usuario[] {
  if (typeof window === 'undefined') {
    return []
  }

  try {
    const raw = window.localStorage.getItem(USERS_CACHE_KEY)
    if (!raw) {
      return []
    }

    const parsed = JSON.parse(raw)
    const entries = Array.isArray(parsed) ? parsed : []

    return entries
      .map(sanitizeUsuario)
      .filter((user): user is Usuario => user !== null)
  } catch {
    window.localStorage.removeItem(USERS_CACHE_KEY)
    return []
  }
}

function persistCachedUsuarios(users: Usuario[]) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(USERS_CACHE_KEY, JSON.stringify(users))
}

function mergeUsers(currentUsers: Usuario[], nextUsers: Usuario[]) {
  const merged = new Map<string, Usuario>()

  for (const user of [...currentUsers, ...nextUsers]) {
    const key = user.correo?.trim().toLowerCase() || `fallback-${user.id}`
    const existing = merged.get(key)

    merged.set(key, {
      ...existing,
      ...user,
      nombre: user.nombre?.trim() || existing?.nombre || user.correo || 'Usuario',
      correo: user.correo?.trim() || existing?.correo || user.correo || '',
      estado: user.estado === 'Activo' ? 'Activo' : existing?.estado ?? 'Desconectado',
    })
  }

  return Array.from(merged.values())
}

export default function Usuarios() {
  const { user } = useAuth()
  const cachedUsuarios = loadCachedUsuarios()
  const [usuarios, setUsuarios] = React.useState<Usuario[]>(cachedUsuarios)
  const [loading, setLoading] = React.useState(cachedUsuarios.length === 0)
  const [error, setError] = React.useState('')
  const [deletingUserId, setDeletingUserId] = React.useState<number | null>(null)
  const [showCreateUserForm, setShowCreateUserForm] = React.useState(false)
  const [creatingUser, setCreatingUser] = React.useState(false)
  const [createMessage, setCreateMessage] = React.useState<string | null>(null)
  const [newUserName, setNewUserName] = React.useState('')
  const [newUserEmail, setNewUserEmail] = React.useState('')
  const [newUserPassword, setNewUserPassword] = React.useState('')
  const [newUserRole, setNewUserRole] = React.useState<UserRole>('Agente')
  const [showNewUserPassword, setShowNewUserPassword] = React.useState(false)
  const [editingUserId, setEditingUserId] = React.useState<number | null>(null)
  const [editingUserName, setEditingUserName] = React.useState('')

  const canCreateUserAccess = canCreateUsers(user)
  const canShowPasswords = canViewPasswords(user)
  const canAssignSupport = canAssignSupportRole(user)
  const canEditUserNames = canManageAgents(user)
  const roleOptions = canAssignSupport
    ? ROLE_OPTIONS
    : ROLE_OPTIONS.filter(role => role !== 'Support')

  const sortedUsuarios = React.useMemo(
    () => [...usuarios].sort((a, b) => {
      const nameA = (a.nombre?.trim() || a.correo?.trim() || '').toLowerCase()
      const nameB = (b.nombre?.trim() || b.correo?.trim() || '').toLowerCase()
      return nameA.localeCompare(nameB, 'es', { sensitivity: 'base' })
    }),
    [usuarios]
  )

  const resetNewUserForm = React.useCallback(() => {
    setNewUserName('')
    setNewUserEmail('')
    setNewUserPassword('')
    setNewUserRole('Agente')
  }, [])

  const syncUserToBackend = React.useCallback(async (name: string, email: string, password: string, role: UserRole) => {
    const response = await fetch(`${API_BASE_URL}/usuarios`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        nombre: name.trim(),
        correo: email.trim(),
        password,
        rol: role,
      }),
    })

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}))
      const message = typeof payload?.error === 'string' && payload.error.trim()
        ? payload.error
        : 'No se pudo sincronizar el usuario con el backend.'
      throw new Error(message)
    }
  }, [])

  const eliminarUsuario = async (usuario: Usuario) => {
    if (!canDeleteUsers(user)) {
      setError('No tienes permisos para eliminar usuarios.')
      return
    }

    if (!window.confirm(`¿Quieres eliminar a ${usuario.nombre?.trim() || usuario.correo?.trim() || 'este usuario'}?`)) {
      return
    }

    setDeletingUserId(usuario.id)

    try {
      const respuesta = await fetch(`${API_BASE_URL}/usuarios/${usuario.id}`, {
        method: 'DELETE',
      })

      if (!respuesta.ok) {
        throw new Error('No se pudo eliminar el usuario')
      }

      setUsuarios(prev => prev.filter(actual => actual.id !== usuario.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setDeletingUserId(null)
    }
  }

  const cargarUsuarios = React.useCallback(async () => {
    if (usuarios.length === 0) {
      setLoading(true)
    }
    setError('')

    try {
      const [respuesta, onlineUsers] = await Promise.all([
        fetch(`${API_BASE_URL}/usuarios`),
        fetchOnlineUsersFromServer(),
      ])

      if (!respuesta.ok) {
        throw new Error('No se pudo obtener la lista de usuarios')
      }

      const data = await respuesta.json()
      const registros = Array.isArray(data) ? data : []
      const onlineByEmail = new Set(
        onlineUsers
          .map(usuario => usuario.email.trim().toLowerCase())
          .filter(Boolean)
      )

      const deduplicados = Array.from(
        new Map(
          registros.map(usuario => [
            String(usuario.correo ?? '').trim().toLowerCase(),
            usuario,
          ])
        ).values()
      )

      const nextUsers: Usuario[] = deduplicados.map(usuario => ({
        id: Number(usuario.id),
        nombre: usuario.nombre ?? usuario.correo ?? 'Usuario',
        correo: String(usuario.correo ?? '').trim(),
        estado: onlineByEmail.has(String(usuario.correo ?? '').trim().toLowerCase())
          ? 'Activo'
          : 'Desconectado',
      }))

      setUsuarios(nextUsers)
      persistCachedUsuarios(nextUsers)
    } catch (err) {
      const fallbackUsers = loadCachedUsuarios()
      if (fallbackUsers.length > 0) {
        setUsuarios(fallbackUsers)
      }

      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }, [])

  const saveUserName = React.useCallback(async (id: number, name: string) => {
    if (!canEditUserNames) {
      setError('No tienes permiso para editar nombres de usuarios. Solo Admin, Gerente y Support pueden hacerlo.')
      setEditingUserId(null)
      setEditingUserName('')
      return
    }

    const previous = usuarios
    const trimmed = name.trim()
    const updatedUser = usuarios.find(u => u.id === id)
    const newUsers = usuarios.map(u => (u.id === id ? { ...u, nombre: trimmed || u.correo || 'Usuario' } : u))

    // Optimistic update
    setUsuarios(newUsers)
    persistCachedUsuarios(newUsers)

    try {
      const res = await fetch(`${API_BASE_URL}/usuarios/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: trimmed }),
      })

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}))
        const message = typeof payload?.error === 'string' && payload.error ? payload.error : 'No se pudo actualizar el usuario.'
        throw new Error(message)
      }

      // Emit sync event to notify all listeners about user name change
      if (typeof window !== 'undefined' && updatedUser) {
        window.localStorage.setItem(USERS_SYNC_STORAGE_KEY, JSON.stringify({
          updatedAt: Date.now(),
          userId: id,
          email: updatedUser.correo,
          newName: trimmed,
        }))
        
        // Dispatch custom event for real-time updates
        window.dispatchEvent(new CustomEvent(USERS_SYNC_STORAGE_KEY, {
          detail: {
            userId: id,
            email: updatedUser.correo,
            newName: trimmed,
          }
        }))
      }
    } catch (err) {
      setUsuarios(previous)
      persistCachedUsuarios(previous)
      setError(err instanceof Error ? err.message : 'Error al actualizar nombre')
    } finally {
      setEditingUserId(null)
      setEditingUserName('')
    }
  }, [usuarios, canEditUserNames])

  const handleCreateUser = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!canCreateUserAccess) {
      setCreateMessage('No tienes permisos para crear usuarios.')
      return
    }

    const trimmedName = newUserName.trim()
    const trimmedEmail = newUserEmail.trim()
    const trimmedPassword = newUserPassword.trim()

    if (!trimmedEmail || !trimmedPassword) {
      setCreateMessage('Completa el correo y la contraseña para agregar el usuario heredado.')
      return
    }

    if (newUserRole === 'Support' && !canAssignSupport) {
      setCreateMessage('Solo usuarios con rol Support pueden asignar el rol Support.')
      return
    }

    setCreatingUser(true)
    setCreateMessage(null)

    const normalizedEmail = trimmedEmail.toLowerCase()
    const existingUser = usuarios.some(usuario =>
      typeof usuario.correo === 'string' && usuario.correo.trim().toLowerCase() === normalizedEmail
    )

    if (existingUser) {
      setCreateMessage('Usuario ya ha sido creado con este correo.')
      setCreatingUser(false)
      return
    }

    const previousUsers = usuarios
    const optimisticUser: Usuario = {
      id: -Math.floor(Date.now() / 1000),
      nombre: trimmedName || trimmedEmail,
      correo: trimmedEmail,
      estado: 'Desconectado',
    }

    setUsuarios(prev => mergeUsers(prev, [optimisticUser]))
    persistCachedUsuarios(mergeUsers(loadCachedUsuarios(), [optimisticUser]))

    try {
      await syncUserToBackend(trimmedName || trimmedEmail, trimmedEmail, trimmedPassword, newUserRole)
      setCreateMessage(`Usuario heredado agregado correctamente con el rol ${newUserRole}.`)
      resetNewUserForm()
      await cargarUsuarios()
      setShowCreateUserForm(false)
    } catch (syncError) {
      setUsuarios(previousUsers)
      persistCachedUsuarios(previousUsers)
      setCreateMessage(
        syncError instanceof Error
          ? syncError.message
          : 'No se pudo crear el usuario. Verifica el correo e intenta nuevamente.'
      )
    } finally {
      setCreatingUser(false)
    }
  }

  React.useEffect(() => {
    void cargarUsuarios()

    const intervalo = window.setInterval(() => {
      void cargarUsuarios()
    }, 10000)

    return () => window.clearInterval(intervalo)
  }, [cargarUsuarios])

  return (
    <div className="p-6">
      <div className="floating-surface min-h-[calc(100vh-5rem)] rounded-[2rem] border border-primary/20 bg-card/95 p-6 shadow-[0_34px_110px_-36px_rgba(59,130,246,0.34),0_18px_42px_-24px_rgba(15,23,42,0.3)] backdrop-blur-md md:p-8 dark:border-primary/35 dark:shadow-[0_34px_120px_-36px_rgba(96,165,250,0.42),0_20px_48px_-26px_rgba(15,23,42,0.38)]">
        <div className="space-y-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-medium text-primary">INTELASIST</p>
              <div className="mt-1 flex items-center gap-3">
                <h1 className="text-2xl font-bold text-foreground">Usuarios</h1>
                <Badge className="border-primary/30 bg-primary/15 px-3 py-1 text-sm font-bold text-primary dark:text-primary">
                  {usuarios.length} {usuarios.length === 1 ? 'usuario registrado' : 'usuarios registrados'}
                </Badge>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Listado de usuarios registrados en la plataforma
              </p>
            </div>

            {canCreateUserAccess ? (
              <div className="md:ml-auto">
                <Button
                  type="button"
                  onClick={() => {
                    setShowCreateUserForm(prev => !prev)
                    setCreateMessage(null)
                  }}
                >
                  {showCreateUserForm ? 'Cerrar' : 'Nuevo usuario'}
                </Button>
              </div>
            ) : null}
          </div>

          {showCreateUserForm ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Crear Nuevo Usuario</CardTitle>
                <CardDescription>
                  Completa todos los campos para crear el usuario.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateUser} className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="new-user-name">Nombre completo <span className="text-muted-foreground">(opcional)</span></Label>
                    <Input
                      id="new-user-name"
                      value={newUserName}
                      onChange={event => setNewUserName(event.target.value)}
                      placeholder="Nombre del usuario"
                    />
                    <p className="text-xs text-muted-foreground">
                      Si dejas el nombre vacío, el sistema usará el correo como nombre visible.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="new-user-email">Correo electrónico</Label>
                    <Input
                      id="new-user-email"
                      type="email"
                      value={newUserEmail}
                      onChange={event => setNewUserEmail(event.target.value)}
                      placeholder="usuario@empresa.com"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="new-user-password">Contraseña</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="new-user-password"
                        type={showNewUserPassword ? 'text' : 'password'}
                        value={newUserPassword}
                        onChange={event => setNewUserPassword(event.target.value)}
                        placeholder="Contraseña del usuario"
                        className="flex-1"
                      />
                      {canShowPasswords ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setShowNewUserPassword(prev => !prev)}
                        >
                          {showNewUserPassword ? 'Ocultar' : 'Mostrar'}
                        </Button>
                      ) : null}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="new-user-role">Puesto</Label>
                    <Select value={newUserRole} onValueChange={value => setNewUserRole(value as UserRole)}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {roleOptions.map(role => (
                          <SelectItem key={role} value={role}>{role}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="md:col-span-2 flex flex-wrap items-center justify-between gap-3">
                    <div className="text-sm text-muted-foreground">
                      {createMessage ? createMessage : 'El usuario podrá iniciar sesión una vez creado.'}
                    </div>
                    <Button type="submit" disabled={creatingUser} className="min-w-[180px]">
                      {creatingUser ? <Spinner className="size-4" /> : 'Agregar usuario heredado'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          ) : null}

          {loading ? (
            <div className="flex min-h-[18rem] items-center justify-center">
              <Spinner className="size-6" />
            </div>
          ) : error ? (
            <Card>
              <CardHeader>
                <CardTitle>Error al cargar</CardTitle>
                <CardDescription>{error}</CardDescription>
              </CardHeader>
            </Card>
          ) : usuarios.length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Sin usuarios</CardTitle>
                <CardDescription>No hay usuarios disponibles en este momento.</CardDescription>
              </CardHeader>
            </Card>
          ) : (
            <div className="space-y-3">
              {sortedUsuarios.map(usuario => {
                const displayName = usuario.nombre?.trim() || usuario.correo?.trim() || 'Usuario'
                const email = usuario.correo?.trim() || 'Correo no disponible'

                return (
                  <div
                    key={usuario.id}
                    className="flex flex-col gap-3 rounded-3xl border border-border bg-card/80 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      {editingUserId === usuario.id && canEditUserNames ? (
                        <div>
                          <Input
                            value={editingUserName}
                            onChange={e => setEditingUserName(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                e.currentTarget.blur()
                                void saveUserName(usuario.id, editingUserName)
                              }
                              if (e.key === 'Escape') {
                                setEditingUserId(null)
                                setEditingUserName('')
                              }
                            }}
                            onBlur={() => {
                              const trimmed = editingUserName.trim()
                              if (trimmed && trimmed !== (usuario.nombre?.trim() || usuario.correo || '')) {
                                void saveUserName(usuario.id, editingUserName)
                              } else {
                                setEditingUserId(null)
                                setEditingUserName('')
                              }
                            }}
                            className="text-sm font-semibold text-foreground truncate"
                            autoFocus
                          />
                          <p className="mt-1 truncate text-xs text-muted-foreground">{email}</p>
                        </div>
                      ) : (
                        <div onDoubleClick={() => { if (canEditUserNames) { setEditingUserId(usuario.id); setEditingUserName(displayName) } }}>
                          <p className={`truncate text-sm font-semibold text-foreground ${canEditUserNames ? 'cursor-pointer hover:text-primary' : ''} ${getNameColorClasses(displayName)}`}>
                            {displayName}
                            {!canEditUserNames && <span className="text-xs text-muted-foreground ml-2">(sin permisos para editar)</span>}
                          </p>
                          <p className="mt-1 truncate text-xs text-muted-foreground">{email}</p>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={usuario.estado === 'Activo' ? 'default' : 'secondary'}>
                        {usuario.estado ?? 'Desconectado'}
                      </Badge>
                      {canDeleteUsers(user) ? (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => eliminarUsuario(usuario)}
                          disabled={deletingUserId === usuario.id}
                        >
                          {deletingUserId === usuario.id ? 'Eliminando…' : 'Eliminar'}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
