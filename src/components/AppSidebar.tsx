import * as React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { fetchOnlineUsersFromServer, getNameColorClasses, getOnlineUsers, getPresenceStyleClasses, getRoleColorClasses, getUserRole, getUserRoles, useAuth, PRESENCE_STORAGE_KEY, PRESENCE_SYNC_STORAGE_KEY, USERS_SYNC_STORAGE_KEY } from '@/lib/auth'
import { PermissionsManagementService } from '@/lib/permissions-management'
import { usePermissions } from '@/lib/permissions-context'
import { UserAvatar } from '@/components/UserAvatar'
import { normalizeAvatar } from '@/lib/avatar'
import type { AvatarData } from '@/lib/avatar'
import { LayoutDashboard, FileText, LogOut, HeartPulse, House } from 'lucide-react'

const ONLINE_USER_FETCH_INTERVAL_MS = 10 * 60 * 1000

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
      userA.presenceStyle !== userB.presenceStyle ||
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
  { to: '/servicios-medicos', label: 'Servicios Médicos', icon: HeartPulse },
  { to: '/asistencia-hogar', label: 'Asistencia en el Hogar', icon: House },
]

export default function AppSidebar() {
  const { hasModuleAccess } = usePermissions()
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const rawDisplayName = (user?.user_metadata?.full_name as string) ?? user?.email ?? 'Usuario'
  const displayName = rawDisplayName
  const avatarUrl = user?.user_metadata?.avatar_url as string | undefined
  const avatarData = React.useMemo(() => normalizeAvatar(user?.user_metadata?.avatar), [user])
  const userRoles = React.useMemo(() => getUserRoles(user), [user])
  const canViewReportsModule = React.useMemo(() => hasModuleAccess('reports'), [hasModuleAccess])
  const [onlineUsers, setOnlineUsers] = React.useState<ReturnType<typeof getOnlineUsers>>(() => getOnlineUsers())
  const [presenceStyles, setPresenceStyles] = React.useState<Record<string, string>>({})
  const [avatarsByEmail, setAvatarsByEmail] = React.useState<Record<string, AvatarData | null>>({})
  const lastServerUsersRef = React.useRef<ReturnType<typeof getOnlineUsers> | null>(null)
  const remoteIntervalRef = React.useRef<number | null>(null)
  const isMountedRef = React.useRef(true)

  const refreshOnlineUsers = React.useCallback(() => {
    setOnlineUsers(prevUsers => {
      const nextUsers = getOnlineUsers()
      return areOnlineUsersEqual(prevUsers, nextUsers) ? prevUsers : nextUsers
    })
  }, [])

  const refreshPresenceStyles = React.useCallback(async () => {
    try {
      // Una sola petición trae estilo de presencia + avatar de cada usuario.
      const directory = await PermissionsManagementService.getProfileDirectory()
      const nextStyles: Record<string, string> = {}
      const nextAvatars: Record<string, AvatarData | null> = {}
      for (const [email, profile] of Object.entries(directory)) {
        nextStyles[email] = profile.presenceStyle
        nextAvatars[email] = profile.avatar
      }
      setPresenceStyles(nextStyles)
      setAvatarsByEmail(nextAvatars)
    } catch {
      setPresenceStyles(prev => prev)
      setAvatarsByEmail(prev => prev)
    }
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

    const handlePresenceStyleChanged = () => {
      void refreshPresenceStyles()
      refreshOnlineUsers()
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
    window.addEventListener('presence-style-changed', handlePresenceStyleChanged)
    window.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      isMountedRef.current = false
      stopRemoteSync()
      window.removeEventListener('storage', handleStorage)
      window.removeEventListener(PRESENCE_SYNC_STORAGE_KEY, handlePresenceSync)
      window.removeEventListener(USERS_SYNC_STORAGE_KEY, handleUsersSync)
      window.removeEventListener('presence-style-changed', handlePresenceStyleChanged)
      window.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [refreshOnlineUsers, refreshOnlineUsersFromServer, refreshPresenceStyles, startRemoteSync, stopRemoteSync])

  React.useEffect(() => {
    void refreshPresenceStyles()
  }, [refreshPresenceStyles])

  React.useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void refreshPresenceStyles()
      }
    }

    window.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [refreshPresenceStyles])

  const visibleUsers = React.useMemo(() => {
    const list = onlineUsers.map(user => {
      const email = user.email.trim().toLowerCase()
      return {
        email,
        fullName: user.fullName,
        role: user.role,
        roles: Array.isArray(user.roles) ? user.roles : (user.role ? [user.role] : []),
        presenceStyle: user.presenceStyle || presenceStyles[email] || 'none',
        avatar: avatarsByEmail[email] ?? null,
        reportsCreated: 0,
      }
    })

    const currentUser = user ? {
      email: String(user.email).trim().toLowerCase(),
      fullName: (user.user_metadata?.full_name as string) || user.email,
      role: getUserRole(user),
      roles: getUserRoles(user),
      presenceStyle: presenceStyles[String(user.email).trim().toLowerCase()] || 'none',
      // El avatar propio sale de la sesión (más actual que el directorio remoto).
      avatar: avatarData ?? avatarsByEmail[String(user.email).trim().toLowerCase()] ?? null,
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
  }, [onlineUsers, user, presenceStyles, avatarsByEmail, avatarData])

  return (
    <Sidebar
      collapsible="icon"
      className="border-r border-sidebar-border bg-sidebar shadow-[0_0_0_1px_rgba(15,23,42,0.05),16px_0_60px_-30px_rgba(0,0,0,0.55)]"
    >
      <SidebarHeader className="px-4 py-5">
        <button
          type="button"
          onClick={() => navigate('/dashboard')}
          className="group flex items-center gap-2.5 rounded-2xl px-2 py-1.5 text-left transition-all duration-200 hover:bg-white/5"
        >
          <div className="sidebar-brand-mark rounded-2xl p-1 transition-all duration-200 group-hover:scale-105 group-hover:shadow-[0_0_30px_rgba(34,211,238,0.65)]">
            <img src="/intelasist.png" alt="INTELASIST" className="h-11 w-11 shrink-0 object-contain" />
          </div>
          <div className="leading-tight group-data-[collapsible=icon]:hidden">
            <span className="block text-sm font-bold tracking-tight text-white">
              INTELASIST
            </span>
            <span className="block text-[10px] font-medium italic tracking-[0.18em] text-slate-400">
              100% panameña
            </span>
          </div>
        </button>
      </SidebarHeader>

      <div className="relative mx-3 my-1">
        <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      </div>

      <SidebarContent className="py-2">
        <SidebarGroup>
          <SidebarGroupLabel className="px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/80">
            Principal
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map(({ to, label, icon: Icon }) => {
                if ((to === '/informes' || to === '/servicios-medicos' || to === '/asistencia-hogar') && !canViewReportsModule) {
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
                      className="group relative rounded-md px-2.5 py-2.5 text-sm font-medium transition-all duration-200 hover:bg-white/5 hover:text-white data-[active=true]:bg-[#43271f] data-[active=true]:text-white data-[active=true]:shadow-none"
                    >
                      <Icon className="size-4 shrink-0 transition-transform duration-200 group-hover:scale-105" />
                      <span>{label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

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
                    <div key={user.email} className={`flex items-center justify-between gap-1.5 rounded-md border border-transparent bg-sidebar/80 px-1.5 py-1 shadow-[0_4px_12px_-12px_rgba(15,23,42,0.25)] transition-all duration-300 ${getPresenceStyleClasses(user.presenceStyle)}`}>
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div className="relative shrink-0">
                          <UserAvatar
                            avatar={user.avatar}
                            name={user.fullName || user.email || 'U'}
                            size={24}
                            className="border border-white/40"
                          />
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
                            className={`connected-role-badge px-1 py-0 h-[13px] flex items-center whitespace-nowrap ${getRoleColorClasses(role, user.fullName)}`}
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
          <div
            title="Perfil del usuario"
            className="shrink-0 rounded-full outline-none"
          >
            <UserAvatar
              avatar={avatarData}
              name={displayName}
              fallbackImageUrl={avatarUrl}
              size={36}
              className="border border-white/40 shadow-sm"
            />
          </div>
          <div className="flex flex-col min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
            <span className={`block px-2 py-1 text-xs font-medium text-sidebar-foreground truncate ${getNameColorClasses(displayName)}`}>
              {displayName}
            </span>
            <span className="px-2 text-xs text-sidebar-foreground/85 truncate">{user?.email}</span>
            <div className="flex flex-wrap gap-1 px-2 mt-1">
              {userRoles.map(role => (
                <Badge key={role} className={`text-[12px] font-semibold px-1.5 py-0.5 ${getRoleColorClasses(role, displayName)} transition-all duration-150`}>
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

      </SidebarFooter>
    </Sidebar>
  )
}
