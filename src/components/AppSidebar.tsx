import * as React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { canManageAgents, fetchOnlineUsersFromServer, getNameColorClasses, getOnlineUsers, getRoleColorClasses, getUserRole, getUserRoles, useAuth, PRESENCE_STORAGE_KEY, PRESENCE_SYNC_STORAGE_KEY, USERS_SYNC_STORAGE_KEY } from '@/lib/auth'
import { getDefaultApiBase } from '@/lib/supabase'
import { PERMISSIONS } from '@/lib/permissions'
import { usePermissions } from '@/lib/permissions-context'
import { LayoutDashboard, FileText, LogOut, FilePlus, Users, AlertCircle, Settings } from 'lucide-react'

const ONLINE_USER_FETCH_INTERVAL_MS = 60000
const FAILED_ATTEMPTS_REFRESH_INTERVAL_MS = 60000

function areOnlineUsersEqual(a: Array<ReturnType<typeof getOnlineUsers>[number]>, b: Array<ReturnType<typeof getOnlineUsers>[number]>) {
  if (a.length !== b.length) {
    return false
  }

  for (let index = 0; index < a.length; index += 1) {
    const userA = a[index]
    const userB = b[index]

    if (
      userA.userId !== userB.userId ||
      userA.email !== userB.email ||
      userA.fullName !== userB.fullName ||
      userA.role !== userB.role ||
      userA.lastSeen !== userB.lastSeen ||
      userA.roles.length !== userB.roles.length ||
      userA.roles.some((role, roleIndex) => role !== userB.roles[roleIndex])
    ) {
      return false
    }
  }

  return true
}

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/informes', label: 'Informes', icon: FileText },
  { to: '/usuarios', label: 'Usuarios', icon: Users },
]

export const AppSidebar = React.memo(function AppSidebar() {
  const { user, signOut, updateCurrentUserProfile } = useAuth()
  const { hasModuleAccess, hasPermission } = usePermissions()
  const navigate = useNavigate()
  const location = useLocation()
  const [profileOpen, setProfileOpen] = React.useState(false)
  const [profileName, setProfileName] = React.useState('')
  const [profileSaving, setProfileSaving] = React.useState(false)
  const [profileMessage, setProfileMessage] = React.useState<string | null>(null)

  const rawDisplayName = (user?.user_metadata?.full_name as string) ?? user?.email ?? 'Usuario'
  const displayName = profileName || rawDisplayName
  const avatarUrl = user?.user_metadata?.avatar_url as string | undefined
  const userRoles = React.useMemo(() => getUserRoles(user), [user])
  const canManageAgentAccess = React.useMemo(() => canManageAgents(user), [user])
  const canViewReportsModule = React.useMemo(() => hasModuleAccess('reports'), [hasModuleAccess])
  const canViewUsersModule = React.useMemo(() => hasModuleAccess('users'), [hasModuleAccess])
  const canViewAdminModule = React.useMemo(
    () => hasPermission(PERMISSIONS.SYSTEM.MANAGE_PERMISSIONS),
    [hasPermission]
  )
  const [onlineUsers, setOnlineUsers] = React.useState<ReturnType<typeof getOnlineUsers>>(() => getOnlineUsers())
  const initials = React.useMemo(() =>
    displayName
      .split(' ')
      .map((n: string) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2),
    [displayName]
  )
  const lastServerUsersRef = React.useRef<ReturnType<typeof getOnlineUsers> | null>(null)
  const remoteIntervalRef = React.useRef<number | null>(null)
  const isMountedRef = React.useRef(true)

  const refreshOnlineUsers = React.useCallback(() => {
    setOnlineUsers(prevUsers => {
      const nextUsers = getOnlineUsers()
      return areOnlineUsersEqual(prevUsers, nextUsers) ? prevUsers : nextUsers
    })
  }, [])

  const refreshOnlineUsersFromServer = React.useCallback(async () => {
    if (document.visibilityState !== 'visible') {
      return
    }

    try {
      const serverUsers = await fetchOnlineUsersFromServer()
      const previousServerUsers = lastServerUsersRef.current ?? []

      if (!areOnlineUsersEqual(previousServerUsers, serverUsers)) {
        lastServerUsersRef.current = serverUsers
        if (isMountedRef.current) {
          setOnlineUsers(serverUsers)
        }
      }
    } catch {
      // Si falla, mantenemos la lista local.
    }
  }, [])

  const startRemoteSync = React.useCallback(() => {
    if (remoteIntervalRef.current !== null) {
      return
    }

    remoteIntervalRef.current = window.setInterval(() => {
      void refreshOnlineUsersFromServer()
    }, ONLINE_USER_FETCH_INTERVAL_MS)
  }, [refreshOnlineUsersFromServer])

  const stopRemoteSync = React.useCallback(() => {
    if (remoteIntervalRef.current !== null) {
      window.clearInterval(remoteIntervalRef.current)
      remoteIntervalRef.current = null
    }
  }, [])

  // Estados para alertas de intentos fallidos
  const [failedAttempts, setFailedAttempts] = React.useState<Array<{
    id: string | number
    email: string
    name: string
    attemptCount: number
    lastAttempt: string
    missingFields: string[]
  }>>([])
  const [alertsOpen, setAlertsOpen] = React.useState(false)
  const isAdminRole = userRoles.includes('Admin') || userRoles.includes('Support') || userRoles.includes('Gerente')

  React.useEffect(() => {
    setProfileName(rawDisplayName)
  }, [rawDisplayName])

  React.useEffect(() => {
    isMountedRef.current = true

    const syncIfVisible = () => {
      refreshOnlineUsers()
      void refreshOnlineUsersFromServer()
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.storageArea !== window.localStorage || event.key !== PRESENCE_STORAGE_KEY) {
        return
      }

      refreshOnlineUsers()
    }

    const handlePresenceSync = () => {
      refreshOnlineUsers()
      void refreshOnlineUsersFromServer()
    }

    const handleUsersSync = (event: Event) => {
      if (event instanceof CustomEvent && event.detail?.email && event.detail?.newName) {
        setOnlineUsers(prevUsers =>
          prevUsers.map(u =>
            u.email.toLowerCase() === event.detail.email.toLowerCase()
              ? { ...u, fullName: event.detail.newName }
              : u
          )
        )
      }

      if (document.visibilityState === 'visible') {
        refreshOnlineUsers()
        void refreshOnlineUsersFromServer()
      }
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        syncIfVisible()
        startRemoteSync()
      } else {
        stopRemoteSync()
      }
    }

    refreshOnlineUsers()
    if (document.visibilityState === 'visible') {
      void refreshOnlineUsersFromServer()
      startRemoteSync()
    }

    window.addEventListener('storage', handleStorage)
    window.addEventListener(PRESENCE_SYNC_STORAGE_KEY, handlePresenceSync)
    window.addEventListener(USERS_SYNC_STORAGE_KEY, handleUsersSync)
    window.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      isMountedRef.current = false
      stopRemoteSync()
      window.removeEventListener('storage', handleStorage)
      window.removeEventListener(PRESENCE_SYNC_STORAGE_KEY, handlePresenceSync)
      window.removeEventListener(USERS_SYNC_STORAGE_KEY, handleUsersSync)
      window.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [refreshOnlineUsers, refreshOnlineUsersFromServer, startRemoteSync, stopRemoteSync])

  // Función para cargar intentos fallidos (fuera del useEffect para ser reutilizable)
  const loadFailedAttempts = React.useCallback(async () => {
    if (!isAdminRole || document.visibilityState !== 'visible') {
      return
    }

    try {
      const API_BASE_URL = getDefaultApiBase()
      const response = await fetch(`${API_BASE_URL}/failed-report-attempts/raw`, { credentials: 'include' })
      if (response.ok) {
        const data = await response.json()
        const attempts = Array.isArray(data.attempts) ? data.attempts : []
        
        console.log(`📋 Intentos fallidos cargados: ${attempts.length} intentos`)
        if (attempts.length > 0) {
          console.log('  Primer intento:', {
            id: attempts[0].id,
            idType: typeof attempts[0].id,
            email: attempts[0].email,
            missingFields: attempts[0].missingFields,
          })
        }
        
        setFailedAttempts(attempts)
      } else {
        console.error('✗ Error en respuesta:', response.status, response.statusText)
      }
    } catch (error) {
      console.error('✗ Error al cargar intentos fallidos (raw):', error)
    }
  }, [isAdminRole])

  // Efecto para cargar intentos fallidos inicialmente y configurar intervalos
  React.useEffect(() => {
    if (!isAdminRole) {
      setFailedAttempts([])
      return
    }

    let intervalId: number | null = null

    const startFailedAttemptInterval = () => {
      if (intervalId !== null || document.visibilityState !== 'visible') {
        return
      }

      intervalId = window.setInterval(() => {
        loadFailedAttempts()
      }, FAILED_ATTEMPTS_REFRESH_INTERVAL_MS)
    }

    const stopFailedAttemptInterval = () => {
      if (intervalId !== null) {
        window.clearInterval(intervalId)
        intervalId = null
      }
    }

    const onFailedAttempt = (_ev: Event) => {
      console.log('🔔 Señal custom failedAttemptRegistered recibida, recargando ahora...')
      loadFailedAttempts()
    }

    const onStorage = (ev: StorageEvent) => {
      if (ev.key === 'failedAttemptSignal') {
        console.log('🔔 Señal storage failedAttemptSignal recibida, recargando ahora...')
        loadFailedAttempts()
      }
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadFailedAttempts()
        startFailedAttemptInterval()
      } else {
        stopFailedAttemptInterval()
      }
    }

    loadFailedAttempts()
    startFailedAttemptInterval()

    window.addEventListener('failedAttemptRegistered', onFailedAttempt as EventListener, true)
    window.addEventListener('storage', onStorage, true)
    window.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      stopFailedAttemptInterval()
      window.removeEventListener('failedAttemptRegistered', onFailedAttempt as EventListener, true)
      window.removeEventListener('storage', onStorage, true)
      window.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [isAdminRole, loadFailedAttempts])

  // Efecto para recargar alertas cuando se abre el diálogo
  React.useEffect(() => {
    if (alertsOpen && isAdminRole) {
      console.log('📋 Diálogo de alertas abierto, recargando...')
      loadFailedAttempts()
    }
  }, [alertsOpen, isAdminRole, loadFailedAttempts])

  const visibleUsers = React.useMemo(() => {
    const list = onlineUsers.map(user => ({
      email: user.email.trim().toLowerCase(),
      fullName: user.fullName,
      role: user.role,
      roles: Array.isArray(user.roles) ? user.roles : (user.role ? [user.role] : []),
      reportsCreated: 0,
    }))

    const currentUser = user ? {
      email: String(user.email).trim().toLowerCase(),
      fullName: (user.user_metadata?.full_name as string) || user.email,
      role: getUserRole(user),
      roles: getUserRoles(user),
      reportsCreated: 0,
    } : null

    const mergedByEmail = new Map<string, NonNullable<typeof currentUser>>()

    if (currentUser?.email) {
      mergedByEmail.set(currentUser.email, currentUser)
    }

    for (const item of list) {
      if (!item.email) {
        continue
      }

      const existing = mergedByEmail.get(item.email)
      if (!existing || (item.fullName && item.fullName !== existing.fullName)) {
        mergedByEmail.set(item.email, item)
      }
    }

    return Array.from(mergedByEmail.values())
  }, [onlineUsers, user])

  const getUserInitials = (value: string) => value
    .split(' ')
    .map(part => part?.trim())
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('')

  const openProfile = (open: boolean) => {
    setProfileOpen(open)
    if (open) {
      setProfileName(rawDisplayName)
      setProfileMessage(null)
    }
  }

  const handleDeleteAttempt = async (id: number) => {
    try {
      console.log(`🗑️ Intentando borrar intento con ID: ${id}`)

      const API_BASE_URL = getDefaultApiBase()
      const resp = await fetch(
        `${API_BASE_URL}/failed-report-attempts/${id}`,
        { method: 'DELETE', credentials: 'include' }
      )

      if (resp.ok) {
        setFailedAttempts(prev =>
          prev.filter(a => Number(a.id) !== Number(id))
        )
      } else {
        console.error('Error borrando intento:', resp.status)
      }
    } catch (err) {
      console.error('Error borrando intento:', err)
    }
  }

  const handleProfileSave = async () => {
    if (!user) {
      return
    }

    const nextName = profileName.trim()

    if (!nextName) {
      setProfileMessage('El nombre no puede estar vacío.')
      return
    }

    setProfileSaving(true)
    setProfileMessage(null)

    try {
      await updateCurrentUserProfile(nextName)
      setProfileOpen(false)
      setProfileMessage('Perfil actualizado correctamente.')
    } catch (error) {
      setProfileMessage(error instanceof Error ? error.message : 'No se pudo actualizar el perfil.')
    } finally {
      setProfileSaving(false)
    }
  }

  return (
    <Sidebar
      collapsible="icon"
      className="border-r border-sidebar-border bg-sidebar shadow-[0_0_0_1px_rgba(15,23,42,0.05),16px_0_60px_-30px_rgba(15,23,42,0.28)]"
    >
      <SidebarHeader className="px-4 py-5">
        <button
          type="button"
          onClick={() => navigate('/dashboard')}
          className="group flex items-center gap-2 text-left rounded-full px-2 py-1.5 transition-all duration-300 hover:bg-primary/10 hover:shadow-[0_0_24px_rgba(59,130,246,0.28)]"
        >
          <div className="rounded-full bg-background/90 p-1 shadow-[0_0_0_1px_rgba(59,130,246,0.12),0_0_18px_rgba(59,130,246,0.16)] transition-all duration-300 group-hover:scale-105 group-hover:shadow-[0_0_0_1px_rgba(59,130,246,0.18),0_0_24px_rgba(59,130,246,0.28)]">
            <img src="/intelasist.png" alt="INTELASIST" className="h-12 w-12 shrink-0 object-contain" />
          </div>
          <span className="font-bold text-sm text-sidebar-foreground group-data-[collapsible=icon]:hidden transition-all duration-300 group-hover:text-primary group-hover:drop-shadow-[0_0_12px_rgba(59,130,246,0.35)]">
            INTELASIST
          </span>
        </button>
      </SidebarHeader>

      <div className="relative mx-3 my-1">
        <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      </div>

      <SidebarContent className="py-2">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map(({ to, label, icon: Icon }) => {
                if ((to === '/informes' && !canViewReportsModule) || (to === '/usuarios' && !canViewUsersModule)) {
                  return null
                }

                return (
                  <SidebarMenuItem key={to}>
                    <SidebarMenuButton
                      isActive={to === '/informes'
                        ? location.pathname === '/informes'
                        : location.pathname.startsWith(to)}
                      tooltip={label}
                      onClick={() => navigate(to)}
                      className="rounded-xl transition-colors duration-150 hover:bg-primary/10 hover:text-primary hover:shadow-[0_0_20px_rgba(59,130,246,0.18)] data-[active=true]:bg-primary/10 data-[active=true]:text-primary"
                    >
                      <Icon className="transition-transform duration-150 group-hover:scale-105" />
                      <span className="transition-colors duration-150 group-hover:drop-shadow-[0_0_10px_rgba(59,130,246,0.28)]">{label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-2">
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip="Nuevo Informe"
                  onClick={() => navigate('/informes/nuevo')}
                  className="rounded-xl bg-destructive/10 text-destructive font-medium transition-colors duration-150 hover:bg-destructive/20 hover:text-destructive hover:shadow-[0_0_22px_rgba(244,63,94,0.2)]"
                >
                  <FilePlus className="transition-transform duration-150 group-hover:scale-105" />
                  <span className="transition-colors duration-150 group-hover:drop-shadow-[0_0_10px_rgba(244,63,94,0.22)]">Nuevo Informe</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {canManageAgentAccess ? (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    tooltip="Control de agentes"
                    onClick={() => navigate('/control-agentes')}
                    className="rounded-xl font-medium transition-colors duration-150 hover:bg-primary/10 hover:text-primary hover:shadow-[0_0_20px_rgba(59,130,246,0.18)]"
                  >
                    <Users className="transition-transform duration-150 group-hover:scale-105" />
                    <span className="transition-colors duration-150 group-hover:drop-shadow-[0_0_10px_rgba(59,130,246,0.28)]">Control de agentes</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ) : null}
              {canAccessAdvancedAdmin(user) && canViewAdminModule ? (
                <SidebarMenuItem>
                  <button
                    onClick={() => setAlertsOpen(true)}
                    className={`w-full rounded-xl font-medium transition-colors duration-150 px-2 py-2 flex items-center gap-2 group ${
                      failedAttempts.length > 0
                        ? 'bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 hover:text-amber-700 hover:shadow-[0_0_22px_rgba(217,119,6,0.2)]'
                        : 'bg-slate-500/10 text-slate-600 hover:bg-slate-500/20 hover:text-slate-700 hover:shadow-[0_0_22px_rgba(71,85,105,0.2)]'
                    }`}
                    title={failedAttempts.length > 0 ? `${failedAttempts.length} usuario(s) con intentos incompletos` : 'Sin alertas'}
                  >
                    <AlertCircle className={`size-4 shrink-0 transition-transform duration-150 group-hover:scale-105 ${
                      failedAttempts.length > 0 ? 'group-hover:animate-pulse' : ''
                    }`} />
                    <span className="transition-colors duration-150 group-hover:drop-shadow-[0_0_10px_rgba(217,119,6,0.22)]">
                      {failedAttempts.length > 0 ? `${failedAttempts.length} alerta${failedAttempts.length !== 1 ? 's' : ''}` : 'Sin alertas'}
                    </span>
                  </button>
                </SidebarMenuItem>
              ) : null}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {canAccessAdvancedAdmin(user) && canViewAdminModule ? (
          <SidebarGroup className="mt-2">
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    tooltip="Administración Avanzada"
                    onClick={() => navigate('/admin/permisos')}
                    className="rounded-xl bg-purple-500/10 text-purple-600 font-medium transition-colors duration-150 hover:bg-purple-500/20 hover:text-purple-700 hover:shadow-[0_0_20px_rgba(168,85,247,0.18)]"
                  >
                    <Settings className="transition-transform duration-150 group-hover:scale-105" />
                    <span className="transition-colors duration-150 group-hover:drop-shadow-[0_0_10px_rgba(168,85,247,0.28)]">⚙ Administración Avanzada</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : null}

        <SidebarGroup className="mt-3 px-2 group-data-[collapsible=icon]:hidden">
          <div className="rounded-lg border border-sidebar-border bg-sidebar-accent/50 p-1.5 backdrop-blur-sm">
            <div className="mb-1.5">
              <p className="text-[9px] font-semibold uppercase tracking-wide text-sidebar-foreground/60">
                Conectados
              </p>
            </div>
            {visibleUsers.length === 0 ? (
              <p className="text-[10px] text-sidebar-foreground/70">Sin usuarios</p>
            ) : (
              <div className="space-y-1">
                {visibleUsers.map(user => {
                  return (
                    <div key={user.email} className="flex items-center justify-between gap-1.5 rounded-md bg-sidebar/80 px-1.5 py-1 shadow-[0_4px_12px_-12px_rgba(15,23,42,0.25)]">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div className="relative shrink-0">
                          <Avatar className="size-6 border border-white/40 bg-primary/10 text-primary">
                            <AvatarFallback className="text-[8px] font-semibold">
                              {getUserInitials(user.fullName || user.email || 'U') || 'U'}
                            </AvatarFallback>
                          </Avatar>
                          <span className="absolute -bottom-0.5 -right-0.5 inline-flex h-2 w-2 rounded-full border-1 border-sidebar bg-emerald-500" />
                        </div>
                        <div className="min-w-0">
                          <p className={`truncate text-[10px] font-medium text-sidebar-foreground ${getNameColorClasses(user.fullName)}`}>{user.fullName || 'Usuario'}</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-0.5 justify-end">
                        {(user.roles ?? []).map(role => (
                          <Badge
                            key={role}
                            title={`Rol: ${role.toUpperCase()}`}
                            className={`text-[8px] font-semibold px-1 py-0 h-4 flex items-center whitespace-nowrap ${getRoleColorClasses(role, user.fullName)}`}
                          >
                            {role.toUpperCase()}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="pb-4">
        <div className="relative mx-3 mb-2">
          <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />
        </div>
        <div className="flex items-center gap-3 px-2 py-1 group-data-[collapsible=icon]:justify-center">
          <Avatar size="sm" className="transition-transform duration-150 hover:scale-105 hover:shadow-[0_0_18px_rgba(59,130,246,0.22)]">
            <AvatarImage src={avatarUrl} alt={displayName} />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
            <button
              type="button"
              onClick={() => openProfile(true)}
              className="rounded-xl px-2 py-1 text-left transition-all duration-150 hover:bg-primary/10 hover:shadow-[0_0_20px_rgba(59,130,246,0.16)]"
            >
              <span className={`block text-xs font-medium text-sidebar-foreground truncate transition-all duration-150 hover:text-primary hover:drop-shadow-[0_0_10px_rgba(59,130,246,0.28)] ${getNameColorClasses(displayName)}`}>
                {displayName}
              </span>
            </button>
            <span className="px-2 text-xs text-sidebar-foreground/85 truncate">{user?.email}</span>
            <div className="flex flex-wrap gap-1 px-2 mt-1">
              {userRoles.map(role => (
                <Badge key={role} className={`text-[8px] font-semibold px-1.5 py-0.5 ${getRoleColorClasses(role, displayName)} transition-all duration-150`}>
                  {role.toUpperCase()}
                </Badge>
              ))}
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={signOut}
            className="shrink-0 rounded-xl text-muted-foreground transition-all duration-150 hover:bg-destructive/10 hover:text-destructive hover:shadow-[0_0_18px_rgba(244,63,94,0.18)] group-data-[collapsible=icon]:hidden"
            title="Cerrar sesión"
          >
            <LogOut className="size-4" />
          </Button>
        </div>

        <Dialog open={profileOpen} onOpenChange={openProfile}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Perfil del usuario</DialogTitle>
              <DialogDescription>
                Actualiza tu nombre visible en la aplicación y en el listado de usuarios conectados.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-1">
              <div className="space-y-2">
                <Label htmlFor="profile-name">Nombre completo</Label>
                <Input
                  id="profile-name"
                  value={profileName}
                  onChange={event => setProfileName(event.target.value)}
                  placeholder="Nombre completo"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="profile-email">Correo</Label>
                <Input id="profile-email" value={user?.email ?? ''} disabled />
              </div>

              {profileMessage ? (
                <p className="text-sm text-muted-foreground bg-muted/60 px-3 py-2 rounded-md">
                  {profileMessage}
                </p>
              ) : null}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => openProfile(false)} disabled={profileSaving}>
                Cancelar
              </Button>
              <Button onClick={handleProfileSave} disabled={profileSaving}>
                {profileSaving ? 'Guardando...' : 'Guardar cambios'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={alertsOpen} onOpenChange={setAlertsOpen}>
          <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-amber-600">
                <AlertCircle className="size-5" />
                Alertas de Informes Incompletos
              </DialogTitle>
              <DialogDescription>
                Usuarios que intentaron crear informes pero dejaron campos incompletos.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2">
                {failedAttempts.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No hay alertas pendientes
                </p>
              ) : (
                failedAttempts.map((attempt: any) => (
                  <div key={`${attempt.id}-${attempt.email}`} className="border border-amber-200 rounded-lg bg-amber-50/50 p-3 space-y-2 flex flex-col">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm text-foreground truncate">{attempt.name || attempt.email}</p>
                        <p className="text-xs text-muted-foreground truncate">{attempt.email}</p>
                        <p className="text-xs text-muted-foreground mt-1">Usuario {attempt.name || attempt.email} no completó el informe.</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{new Date(attempt.attemptedAt).toLocaleString('es-ES')}</span>
                        <Button variant="outline" size="sm" onClick={() => handleDeleteAttempt(attempt.id)} className="ml-2">Borrar</Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setAlertsOpen(false)}>
                Cerrar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </SidebarFooter>
    </Sidebar>
  )
})
