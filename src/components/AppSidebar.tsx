import * as React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { getOnlineUsers, getPresenceStyleClasses, getUserRole, getUserRoles, useAuth, PRESENCE_STORAGE_KEY, PRESENCE_SYNC_STORAGE_KEY, USERS_SYNC_STORAGE_KEY } from '@/lib/auth'
import { PermissionsManagementService } from '@/lib/permissions-management'
import { usePermissions } from '@/lib/permissions-context'
import { UserAvatar } from '@/components/UserAvatar'
import { normalizeAvatar } from '@/lib/avatar'
import type { AvatarData } from '@/lib/avatar'
import { LayoutDashboard, FileText, LogOut, HeartPulse, House, Users, ChevronLeft } from 'lucide-react'
import { PERMISSIONS } from '@/lib/permissions'
import './GlassSidebar.css'

function isUserRole(role: unknown): role is 'Agente' | 'Admin' | 'Support' | 'Gerente' {
  return role === 'Agente' || role === 'Admin' || role === 'Support' || role === 'Gerente'
}

function parsePresenceSnapshot(value: unknown): ReturnType<typeof getOnlineUsers> {
  if (!Array.isArray(value)) {
    return []
  }

  const usersByEmail = new Map<string, ReturnType<typeof getOnlineUsers>[number]>()
  for (const candidate of value) {
    if (
      !candidate ||
      typeof candidate.userId !== 'string' ||
      candidate.userId.startsWith('local-created-') ||
      typeof candidate.email !== 'string' ||
      typeof candidate.fullName !== 'string' ||
      typeof candidate.lastSeen !== 'number'
    ) {
      continue
    }

    const email = candidate.email.trim().toLowerCase()
    if (!email) {
      continue
    }

    const role = isUserRole(candidate.role) ? candidate.role : 'Agente'
    const roles = Array.isArray(candidate.roles)
      ? candidate.roles.filter(isUserRole)
      : [role]
    const user = {
      userId: candidate.userId,
      email,
      fullName: candidate.fullName,
      role,
      roles: roles.length > 0 ? roles : [role],
      lastSeen: candidate.lastSeen,
    }
    const current = usersByEmail.get(email)
    if (!current || user.lastSeen > current.lastSeen) {
      usersByEmail.set(email, user)
    }
  }

  return Array.from(usersByEmail.values()).sort((a, b) => b.lastSeen - a.lastSeen)
}

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
  { to: '/usuarios', label: 'Usuarios', icon: Users },
]

export default function AppSidebar() {
  const { hasModuleAccess, hasPermission } = usePermissions()
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [glassOpen, setGlassOpen] = React.useState(false)
  const [glassSearch, setGlassSearch] = React.useState('')
  const [glassTab, setGlassTab] = React.useState({ y: 0, h: 0, ready: false })
  const glassMainRef = React.useRef<HTMLDivElement>(null)
  const glassRailRef = React.useRef<HTMLElement>(null)
  const dockFrameRef = React.useRef<number | null>(null)
  const dockYRef = React.useRef(0)
  const glassItemRefs = React.useRef<Record<string, HTMLButtonElement | null>>({})

  const rawDisplayName = (user?.user_metadata?.full_name as string) ?? user?.email ?? 'Usuario'
  const displayName = rawDisplayName
  const avatarUrl = user?.user_metadata?.avatar_url as string | undefined
  const avatarData = React.useMemo(() => normalizeAvatar(user?.user_metadata?.avatar), [user])
  const userRoles = React.useMemo(() => getUserRoles(user), [user])
  const canViewReportsModule = React.useMemo(() => hasModuleAccess('reports'), [hasModuleAccess])
  const canViewUsersModule =
    hasModuleAccess('users') || hasPermission(PERMISSIONS.USERS.VIEW)
  const [onlineUsers, setOnlineUsers] = React.useState<ReturnType<typeof getOnlineUsers>>(() => getOnlineUsers())
  const [presenceStyles, setPresenceStyles] = React.useState<Record<string, string>>({})
  const [avatarsByEmail, setAvatarsByEmail] = React.useState<Record<string, AvatarData | null>>({})
  const hasReceivedPresenceSnapshotRef = React.useRef(false)

  const refreshOnlineUsers = React.useCallback(() => {
    if (hasReceivedPresenceSnapshotRef.current) {
      return
    }

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

  React.useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.storageArea !== window.localStorage || event.key !== PRESENCE_STORAGE_KEY) {
        return
      }

      refreshOnlineUsers()
    }

    const handlePresenceSync = () => {
      refreshOnlineUsers()
    }

    const handlePresenceSnapshot = (event: Event) => {
      if (!(event instanceof CustomEvent)) {
        return
      }

      const users = parsePresenceSnapshot(event.detail?.users ?? event.detail)
      hasReceivedPresenceSnapshotRef.current = true
      setOnlineUsers(previous => areOnlineUsersEqual(previous, users) ? previous : users)
    }

    const handleRemotePresence = (event: Event) => {
      if (!(event instanceof CustomEvent)) {
        return
      }

      const payload = event.detail as {
        action?: string
        userId?: string
        user?: {
          userId?: string
          email?: string
          fullName?: string
          role?: unknown
          roles?: unknown
          lastSeen?: number
        }
      }
      if (payload.action === 'offline') {
        const userId = payload.userId || payload.user?.userId
        if (typeof userId === 'string') {
          setOnlineUsers(previous => previous.filter(onlineUser => onlineUser.userId !== userId))
        }
        return
      }

      const remoteUser = payload.user
      if (
        payload.action !== 'online' ||
        typeof remoteUser?.userId !== 'string' ||
        remoteUser.userId.startsWith('local-created-') ||
        typeof remoteUser.email !== 'string' ||
        typeof remoteUser.fullName !== 'string' ||
        typeof remoteUser.lastSeen !== 'number'
      ) {
        return
      }

      const role = isUserRole(remoteUser.role) ? remoteUser.role : 'Agente'
      const roles = Array.isArray(remoteUser.roles)
        ? remoteUser.roles.filter(isUserRole)
        : [role]
      const normalizedEmail = remoteUser.email.trim().toLowerCase()
      if (!normalizedEmail) {
        return
      }

      const nextUser = {
        userId: remoteUser.userId,
        email: normalizedEmail,
        fullName: remoteUser.fullName,
        role,
        roles: roles.length > 0 ? roles : [role],
        lastSeen: remoteUser.lastSeen,
      }

      setOnlineUsers(previous => {
        const updated = [
          ...previous.filter(onlineUser =>
            onlineUser.userId !== nextUser.userId &&
            onlineUser.email.trim().toLowerCase() !== normalizedEmail
          ),
          nextUser,
        ].sort((a, b) => b.lastSeen - a.lastSeen)
        return areOnlineUsersEqual(previous, updated) ? previous : updated
      })
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
      }
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshOnlineUsers()
      }
    }

    refreshOnlineUsers()

    window.addEventListener('storage', handleStorage)
    window.addEventListener(PRESENCE_SYNC_STORAGE_KEY, handlePresenceSync)
    window.addEventListener('presence-snapshot', handlePresenceSnapshot)
    window.addEventListener('presence-updated', handleRemotePresence)
    window.addEventListener(USERS_SYNC_STORAGE_KEY, handleUsersSync)
    window.addEventListener('presence-style-changed', handlePresenceStyleChanged)
    window.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('storage', handleStorage)
      window.removeEventListener(PRESENCE_SYNC_STORAGE_KEY, handlePresenceSync)
      window.removeEventListener('presence-snapshot', handlePresenceSnapshot)
      window.removeEventListener('presence-updated', handleRemotePresence)
      window.removeEventListener(USERS_SYNC_STORAGE_KEY, handleUsersSync)
      window.removeEventListener('presence-style-changed', handlePresenceStyleChanged)
      window.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [refreshOnlineUsers, refreshPresenceStyles])

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

  const visibleNavItems = navItems.filter(({ to }) => {
    if ((to === '/informes' || to === '/servicios-medicos' || to === '/asistencia-hogar') && !canViewReportsModule) return false
    if (to === '/usuarios' && !canViewUsersModule) return false
    return true
  })

  const activeNav = visibleNavItems.find(({ to }) =>
    to === '/informes'
      ? location.pathname === '/informes' || location.pathname.startsWith('/informes/')
      : location.pathname.startsWith(to)
  ) ?? visibleNavItems[0]

  React.useLayoutEffect(() => {
    if (!glassOpen) return
    const measure = () => {
      const item = activeNav ? glassItemRefs.current[activeNav.to] : null
      const main = glassMainRef.current
      if (!item || !main) return
      const a = item.getBoundingClientRect()
      const b = main.getBoundingClientRect()
      setGlassTab({ y: a.top - b.top - 4, h: a.height + 8, ready: true })
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [glassOpen, activeNav])

  React.useEffect(() => {
    if (!glassOpen) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setGlassOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [glassOpen])

  React.useEffect(() => () => {
    if (dockFrameRef.current !== null) {
      window.cancelAnimationFrame(dockFrameRef.current)
    }
  }, [])

  const handleDockMove = (event: React.MouseEvent<HTMLElement>) => {
    dockYRef.current = event.clientY
    if (dockFrameRef.current !== null) return

    dockFrameRef.current = window.requestAnimationFrame(() => {
      dockFrameRef.current = null
      glassRailRef.current?.querySelectorAll<HTMLElement>('[data-dock]').forEach(element => {
        const rect = element.getBoundingClientRect()
        const distance = dockYRef.current - (rect.top + rect.height / 2)
        const scale = 1 + 0.45 * Math.exp(-(distance * distance) / (2 * 42 * 42))
        element.style.setProperty('--s', scale.toFixed(3))
      })
    })
  }

  const handleDockLeave = () => {
    if (dockFrameRef.current !== null) {
      window.cancelAnimationFrame(dockFrameRef.current)
      dockFrameRef.current = null
    }
    glassRailRef.current?.querySelectorAll<HTMLElement>('[data-dock]').forEach(element => {
      element.style.setProperty('--s', '1')
    })
  }

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault()
    const query = glassSearch.trim()
    setGlassOpen(false)
    navigate(query ? `/informes?search=${encodeURIComponent(query)}` : '/informes')
  }

  return (
    <aside className={`gs ${glassOpen ? 'is-open' : ''}`} aria-label="Menú principal">
      <nav
        className="gs__rail"
        ref={glassRailRef}
        onMouseMove={handleDockMove}
        onMouseLeave={handleDockLeave}
        aria-hidden={glassOpen}
      >
        <button data-dock className="gs-brand" onClick={() => setGlassOpen(true)} aria-label="Abrir menú">
          <span aria-hidden="true">IA</span>
        </button>
        {visibleNavItems.map(({ to, label, icon: Icon }) => (
          <button
            key={to}
            data-dock
            className={`gs-orb ${activeNav?.to === to ? 'is-active' : ''}`}
            onClick={() => navigate(to)}
            aria-label={label}
            title={label}
          >
            <Icon />
          </button>
        ))}
        <span className="gs__grow" />
        <button data-dock className="gs-avatar" onClick={() => setGlassOpen(true)} aria-label="Abrir perfil">
          <UserAvatar avatar={avatarData} name={displayName} fallbackImageUrl={avatarUrl} size={38} />
        </button>
      </nav>

      <div className="gs__panel" aria-hidden={!glassOpen}>
        <div className="gs__main" ref={glassMainRef}>
          <span
            className="gs__tab"
            style={{
              transform: `translateY(${glassTab.y}px)`,
              height: glassTab.h,
              opacity: glassTab.ready ? 1 : 0,
            }}
          />
          <div className="gs__inner">
            <header className="gs-reveal gs-head" style={{ '--i': 0 } as React.CSSProperties}>
              <img className="gs-orb--lg" src="/intelasist-sidebar.svg" alt="INTELASIST IA" />
              <div className="gs-head__txt">
                <b>INTELASIST</b>
                <small>{displayName}</small>
              </div>
              <button className="gs-round" onClick={() => setGlassOpen(false)} aria-label="Cerrar menú">
                <ChevronLeft />
              </button>
            </header>

            {canViewReportsModule ? (
              <form className="gs-reveal gs-search" style={{ '--i': 1 } as React.CSSProperties} onSubmit={submitSearch}>
                <FileText />
                <input
                  value={glassSearch}
                  onChange={event => setGlassSearch(event.target.value)}
                  placeholder="Buscar informes…"
                  aria-label="Buscar informes"
                />
                <kbd>↵</kbd>
              </form>
            ) : null}

            <ul className="gs__nav">
              {visibleNavItems.map(({ to, label, icon: Icon }, index) => (
                <li key={to} className="gs-reveal" style={{ '--i': index + 2 } as React.CSSProperties}>
                  <button
                    ref={element => { glassItemRefs.current[to] = element }}
                    onClick={() => navigate(to)}
                    className={`gs-item ${activeNav?.to === to ? 'is-active' : ''}`}
                  >
                    <Icon />
                    <span>{label}</span>
                  </button>
                </li>
              ))}
            </ul>

            <div className="gs-reveal gs-connected" style={{ '--i': visibleNavItems.length + 3 } as React.CSSProperties}>
              <p className="gs-connected__title">Conectados</p>
              {visibleUsers.length === 0 ? (
                <p className="gs-connected__empty">Sin usuarios</p>
              ) : (
                <div className="gs-connected__list">
                  {visibleUsers.map(connectedUser => (
                    <div
                      key={connectedUser.email}
                      className={`gs-connected__item ${getPresenceStyleClasses(connectedUser.presenceStyle)}`}
                    >
                      <UserAvatar
                        avatar={connectedUser.avatar}
                        name={connectedUser.fullName || connectedUser.email || 'U'}
                        size={24}
                        characterWithBackground={false}
                      />
                      <span>{connectedUser.fullName || 'Usuario'}</span>
                      <i />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="gs-reveal gs-user" style={{ '--i': visibleNavItems.length + 4 } as React.CSSProperties}>
              <span className="gs-avatar">
                <UserAvatar avatar={avatarData} name={displayName} fallbackImageUrl={avatarUrl} size={38} />
              </span>
              <div>
                <b>{displayName}</b>
                <small>{user?.email}</small>
              </div>
              <button className="gs-logout" onClick={signOut} aria-label="Cerrar sesión" title="Cerrar sesión">
                <LogOut />
              </button>
            </div>
          </div>
        </div>

        <div className="gs__spine">
          {canViewReportsModule ? (
            <button
              className="gs-cta"
              onClick={() => navigate('/informes/nuevo')}
              aria-label="Nuevo informe"
              title="Nuevo informe"
            >
              <FileText />
            </button>
          ) : (
            <button className="gs-cta" onClick={() => navigate('/dashboard')} aria-label="Dashboard" title="Dashboard">
              <LayoutDashboard />
            </button>
          )}
          <span className="gs__label">{activeNav?.label}</span>
        </div>
      </div>
    </aside>
  )
}
