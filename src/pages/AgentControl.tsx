import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Spinner } from '@/components/ui/spinner'
import { canManageAgents, fetchOnlineUsersFromServer, getOnlineUsers, getUserRoles, isAdminUser, mergeOnlineUsers, updateStoredUserRoles, useAuth, type UserRole } from '@/lib/auth'
import { ArrowLeft, ShieldAlert, Users } from 'lucide-react'

const getDefaultApiBase = () => {
  if (import.meta.env.VITE_API_BASE_URL) return import.meta.env.VITE_API_BASE_URL
  return 'https://intelasist.onrender.com'
}
const API_BASE_URL = getDefaultApiBase()

interface AgentRow {
  id?: string
  email: string
  fullName: string
  roles: UserRole[]
  source: 'admin' | 'backend' | 'local'
}

interface BackendUserRecord {
  id: number
  correo?: string | null
  nombre?: string | null
  rol?: string | null
  roles?: unknown
}

const ROLE_OPTIONS: UserRole[] = ['Agente', 'Admin', 'Support', 'Gerente']

function dedupeAgentsByEmail(agents: AgentRow[]) {
  const deduped = new Map<string, AgentRow>()

  for (const agent of agents) {
    const email = agent.email.trim().toLowerCase()
    if (!email) {
      continue
    }

    const current = deduped.get(email)
    if (!current) {
      deduped.set(email, agent)
      continue
    }

    const priority = (source: AgentRow['source']) => source === 'admin' ? 3 : source === 'local' ? 2 : 1
    if (priority(agent.source) > priority(current.source)) {
      deduped.set(email, agent)
    }
  }

  return Array.from(deduped.values())
}

function normalizeRolesFromValue(value: unknown): UserRole[] {
  if (Array.isArray(value)) {
    return Array.from(new Set(value
      .map(role => typeof role === 'string' ? role.trim() : '')
      .filter((role): role is UserRole => ROLE_OPTIONS.includes(role as UserRole))))
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) {
      return []
    }

    if (trimmed.startsWith('[')) {
      try {
        return normalizeRolesFromValue(JSON.parse(trimmed))
      } catch {
        // Se intenta el flujo simple a continuación.
      }
    }

    return ROLE_OPTIONS.includes(trimmed as UserRole)
      ? [trimmed as UserRole]
      : []
  }

  return []
}

function normalizeAgentRoles(value: unknown, fallbackRole?: UserRole): UserRole[] {
  const roles = normalizeRolesFromValue(value)
  if (roles.length > 0) {
    return roles
  }

  if (fallbackRole && ROLE_OPTIONS.includes(fallbackRole)) {
    return [fallbackRole]
  }

  return ['Agente']
}

async function fetchBackendAgentUsers(): Promise<BackendUserRecord[]> {
  const response = await fetch(`${API_BASE_URL}/usuarios`)

  if (!response.ok) {
    throw new Error('No se pudo leer la lista de usuarios registrados.')
  }

  const data = await response.json()
  return Array.isArray(data) ? data : []
}

export default function AgentControl() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [agents, setAgents] = React.useState<AgentRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [message, setMessage] = React.useState<string | null>(null)
  const [updatingAgent, setUpdatingAgent] = React.useState<string | null>(null)
  const [draftRoles, setDraftRoles] = React.useState<Record<string, UserRole[]>>({})

  const canManageAgentAccess = canManageAgents(user)
  const canAssignCreatorRole = isAdminUser(user)
  const canViewAllCreatedUsers = canManageAgentAccess
  const roleOptions = canAssignCreatorRole
    ? ROLE_OPTIONS
    : ROLE_OPTIONS.filter(role => role !== 'Support')

  const ensureCurrentUserInAgents = React.useCallback((currentAgents: AgentRow[]) => {
    if (!user?.email) {
      return currentAgents
    }

    const normalizedEmail = user.email.toLowerCase()
    if (currentAgents.some(agent => agent.email.toLowerCase() === normalizedEmail)) {
      return currentAgents
    }

    return [
      {
        id: user.id,
        email: user.email,
        fullName: (user.user_metadata?.full_name as string) ?? user.email,
        roles: getUserRoles(user),
        source: 'local' as const,
      },
      ...currentAgents,
    ]
  }, [user])

  React.useEffect(() => {
    if (!canManageAgentAccess) {
      navigate('/dashboard', { replace: true })
    }
  }, [canManageAgentAccess, navigate])

  React.useEffect(() => {
    setDraftRoles(prev => {
      const next = { ...prev }
      for (const agent of agents) {
        next[agent.email] = agent.roles
      }
      return next
    })
  }, [agents])

  const loadAgents = React.useCallback(async () => {
    setLoading(true)
    setMessage(null)

    let nextAgents: AgentRow[] = []

    const [remoteUsers, localUsers] = await Promise.all([
      fetchOnlineUsersFromServer(),
      Promise.resolve(getOnlineUsers()),
    ])

    const presenceUsers = mergeOnlineUsers(localUsers, remoteUsers)
    const presenceByEmail = new Map(
      presenceUsers.map(user => [user.email.trim().toLowerCase(), user])
    )

    if (canViewAllCreatedUsers) {
      try {
        const backendUsers = await fetchBackendAgentUsers()
        nextAgents = backendUsers
          .map(user => {
            const normalizedEmail = String(user.correo ?? '').trim().toLowerCase()
            const presenceUser = presenceByEmail.get(normalizedEmail)

            return {
              id: String(user.id),
              email: normalizedEmail,
              fullName: presenceUser?.fullName || user.nombre?.trim() || normalizedEmail || 'Usuario',
              roles: normalizeAgentRoles(user.roles ?? user.rol, presenceUser?.role),
              source: 'backend' as const,
            }
          })
          .filter(user => Boolean(user.email))
      } catch (error) {
        console.error('Error cargando usuarios registrados desde el backend:', error)
        setMessage('No se pudo cargar la lista de agentes desde el backend.')
      }
    }

    if (!canViewAllCreatedUsers) {
      setAgents([])
      setLoading(false)
      return
    }

    nextAgents = dedupeAgentsByEmail(nextAgents)
    nextAgents = ensureCurrentUserInAgents(nextAgents)

    setAgents(nextAgents.sort((a, b) => a.fullName.localeCompare(b.fullName)))
    setLoading(false)
  }, [canViewAllCreatedUsers, ensureCurrentUserInAgents])

  React.useEffect(() => {
    void loadAgents()
  }, [loadAgents])

  const toggleAgentRole = (agentEmail: string, role: UserRole) => {
    const currentRoles = draftRoles[agentEmail] ?? []
    const nextRoles = currentRoles.includes(role)
      ? currentRoles.filter(existing => existing !== role)
      : [...currentRoles, role]

    setDraftRoles(prev => ({
      ...prev,
      [agentEmail]: nextRoles,
    }))
  }

  const handleAgentRolesChange = async (agent: AgentRow) => {
    if (!canManageAgentAccess) {
      setMessage('No tienes permisos para modificar la información de agentes.')
      return
    }

    const nextRoles = draftRoles[agent.email] ?? agent.roles
    const normalizedRoles = Array.from(new Set(nextRoles.filter(role => roleOptions.includes(role))))
    const normalizedEmail = String(agent.email).trim().toLowerCase()

    if (normalizedRoles.length === 0) {
      setMessage('Selecciona al menos un rol para guardar.')
      return
    }

    if (normalizedRoles.includes('Support') && !canAssignCreatorRole) {
      setMessage('Solo usuarios con rol Admin pueden asignar el rol Support.')
      return
    }

    setUpdatingAgent(agent.email)
    setMessage(null)

    try {
      const response = await fetch(`${API_BASE_URL}/usuarios/${encodeURIComponent(agent.email)}/rol`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ roles: normalizedRoles }),
      })

      const payload = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(payload.error || 'No se pudo actualizar los roles en el servidor.')
      }

      setAgents(prev => prev.map(current => current.email === agent.email
        ? { ...current, roles: normalizedRoles }
        : current))
      updateStoredUserRoles(agent.email, normalizedRoles)
      setMessage('Roles actualizados correctamente.')
    } catch (error) {
      setMessage(error instanceof Error
        ? `No se pudo guardar el rol en el servidor: ${error.message}`
        : 'No se pudo guardar el rol en el servidor.')
    } finally {
      setUpdatingAgent(null)
    }
  }

  if (!canManageAgentAccess) {
    return null
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon-sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="size-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Control de agentes</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Asigna uno o varios roles a los agentes registrados en el sistema.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="size-4" />
            Usuarios y roles
          </CardTitle>
          <CardDescription>
            Control de los agentes registrados en el sistema.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">ADMINISTRADORES</Badge>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner className="size-4" />
              Cargando agentes...
            </div>
          ) : null}

          {message ? (
            <p className="text-sm text-muted-foreground bg-muted/60 px-3 py-2 rounded-md">{message}</p>
          ) : null}

          {!loading && agents.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No hay agentes disponibles para mostrar.
            </div>
          ) : null}

          <div className="space-y-3">
            {agents.map(agent => {
              const selectedRoles = draftRoles[agent.email] ?? agent.roles

              return (
                <div
                  key={agent.email}
                  className="rounded-lg border border-border p-3"
                >
                  <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-start">
                    <div>
                      <p className="font-medium text-foreground">{agent.fullName}</p>
                      <p className="text-sm text-muted-foreground">{agent.email}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {selectedRoles.map(role => (
                          <Badge key={`${agent.email}-${role}`} variant="outline">{role}</Badge>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-end">
                      <Badge variant={agent.source === 'admin' ? 'default' : 'outline'}>
                        {agent.source === 'admin' ? 'Admin' : 'INTELASIST'}
                      </Badge>
                    </div>
                  </div>

                  <div className="mt-3 rounded-md border border-dashed border-border bg-muted/30 p-3 space-y-3">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Roles</p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {roleOptions.map(role => {
                          const isChecked = selectedRoles.includes(role)

                          return (
                            <label
                              key={role}
                              className={`flex items-center gap-3 rounded-md border border-border bg-background px-3 py-2 text-sm ${isDisabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-muted/60'}`}
                            >
                              <Checkbox
                                checked={isChecked}
                                disabled={updatingAgent === agent.email}
                                onCheckedChange={() => toggleAgentRole(agent.email, role)}
                              />
                              <span>{role}</span>
                            </label>
                          )
                        })}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => handleAgentRolesChange(agent)}
                        disabled={updatingAgent === agent.email || (draftRoles[agent.email]?.length ?? 0) === 0}
                      >
                        Guardar roles
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldAlert className="size-4" />
            Acceso restringido
          </CardTitle>
          <CardDescription>
            Esta plataforma se reserva los derechos de autorización y control de los agentes que pueden acceder al sistema. Si desea alguna personalizacion contacta con el soporte.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  )
}
