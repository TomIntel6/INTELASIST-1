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
import { fetchOnlineUsersFromServer, getNameColorClasses, getOnlineUsers, getPresenceStyleClasses, getRoleColorClasses, getUserRole, getUserRoles, useAuth, PRESENCE_STORAGE_KEY, PRESENCE_SYNC_STORAGE_KEY, USERS_SYNC_STORAGE_KEY } from '@/lib/auth'
import { getDefaultApiBase } from '@/lib/supabase'
import { PERMISSIONS } from '@/lib/permissions'
import { getReportFieldLabel } from '@/lib/report-alerts'
import { PermissionsManagementService } from '@/lib/permissions-management'
import { usePermissions } from '@/lib/permissions-context'
import { UserAvatar } from '@/components/UserAvatar'
import { ProfileAvatarEditor } from '@/components/ProfileAvatarEditor'
import { normalizeAvatar } from '@/lib/avatar'
import type { AvatarData } from '@/lib/avatar'
import { toast } from 'sonner'
import { LayoutDashboard, FileText, LogOut, FilePlus, Users, AlertCircle, Settings } from 'lucide-react'

const ONLINE_USER_FETCH_INTERVAL_MS = 10 * 60 * 1000
const FAILED_ATTEMPTS_REFRESH_INTERVAL_MS = 10 * 60 * 1000

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
  { to: '/usuarios', label: 'Usuarios', icon: Users },
]

export const AppSidebar = React.memo(function AppSidebar() {
  const { user, signOut, updateCurrentUserProfile, updateCurrentUserAvatar } = useAuth()
  const { permissions, hasModuleAccess, hasPermission } = usePermissions()
  const navigate = useNavigate()
  const location = useLocation()
  const [profileOpen, setProfileOpen] = React.useState(false)
  const [profileName, setProfileName] = React.useState('')
  const [profileSaving, setProfileSaving] = React.useState(false)
  const [profileMessage, setProfileMessage] = React.useState<string | null>(null)

  const rawDisplayName = (user?.user_metadata?.full_name as string) ?? user?.email ?? 'Usuario'
  const displayName = profileName || rawDisplayName
  const avatarUrl = user?.user_metadata?.avatar_url as string | undefined
  const avatarData = React.useMemo(() => normalizeAvatar(user?.user_metadata?.avatar), [user])
  const userRoles = React.useMemo(() => getUserRoles(user), [user])
  // El permiso granular controla la personalización; Admin/Support la conservan
  // siempre porque son quienes administran los permisos.
  const canCustomizeAvatar = React.useMemo(
    () =>
      hasPermission(PERMISSIONS.PROFILE.CUSTOMIZE_AVATAR) ||
      userRoles.includes('Admin') ||
      userRoles.includes('Support'),
    [hasPermission, userRoles]
  )
  // Permiso granular adicional: subir/usar una imagen como avatar. Restringido por
  // defecto; solo Admin/Support y quienes lo tengan concedido ven la opción "Imagen".
  const canUploadAvatarImage = React.useMemo(
    () =>
      hasPermission(PERMISSIONS.PROFILE.UPLOAD_AVATAR_IMAGE) ||
      userRoles.includes('Admin') ||
      userRoles.includes('Support'),
    [hasPermission, userRoles]
  )
  const canViewReportsModule = React.useMemo(() => hasModuleAccess('reports'), [hasModuleAccess])
  const canViewUsersModule = React.useMemo(
    () => hasModuleAccess('users') || hasPermission(PERMISSIONS.USERS.VIEW),
    [hasModuleAccess, hasPermission]
  )
  const canViewAdminModule = React.useMemo(
    () => hasPermission(PERMISSIONS.SYSTEM.MANAGE_PERMISSIONS),
    [hasPermission]
  )
  const rawSystemPermissions = React.useMemo<Record<string, boolean>>(
    () => permissions?.permissions ?? {},
    [permissions]
  )
  const canViewAlerts = React.useMemo(
    () => Boolean(rawSystemPermissions[PERMISSIONS.SYSTEM.VIEW_ALERTS])
      || Boolean(rawSystemPermissions[PERMISSIONS.SYSTEM.MANAGE_ALERTS])
      || hasPermission(PERMISSIONS.SYSTEM.VIEW_ALERTS)
      || hasPermission(PERMISSIONS.SYSTEM.MANAGE_ALERTS),
    [rawSystemPermissions, hasPermission]
  )
  const canManageAlerts = React.useMemo(
    () => Boolean(rawSystemPermissions[PERMISSIONS.SYSTEM.MANAGE_ALERTS])
      || hasPermission(PERMISSIONS.SYSTEM.MANAGE_ALERTS),
    [rawSystemPermissions, hasPermission]
  )
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

  // Estados para alertas de intentos fallidos
  const [failedAttempts, setFailedAttempts] = React.useState<Array<{
    id: string | number
    email: string
    name: string
    attemptCount: number
    lastAttempt: string
    missingFields: string[]
    completedFields: string[]
    missingFieldLabels?: string[]
    completedFieldLabels?: string[]
    missingDetails?: Array<{ field: string; label: string; value: string }>
    completedDetails?: Array<{ field: string; label: string; value: string }>
  }>>([])
  const [alertsOpen, setAlertsOpen] = React.useState(false)
  const isAdminRole = userRoles.includes('Admin') || userRoles.includes('Support') || userRoles.includes('Gerente')
  const canAccessFailedAlerts = canViewAlerts || isAdminRole

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

  // Función para cargar intentos fallidos (fuera del useEffect para ser reutilizable)
  const loadFailedAttempts = React.useCallback(async () => {
    if (!canAccessFailedAlerts || document.visibilityState !== 'visible') {
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
        
        setFailedAttempts(attempts.map((attempt: any) => ({
          ...attempt,
          missingFields: Array.isArray(attempt.missingFields) ? attempt.missingFields : [],
          completedFields: Array.isArray(attempt.completedFields) ? attempt.completedFields : [],
          missingFieldLabels: Array.isArray(attempt.missingFieldLabels) ? attempt.missingFieldLabels : Array.isArray(attempt.missing_field_labels) ? attempt.missing_field_labels : [],
          completedFieldLabels: Array.isArray(attempt.completedFieldLabels) ? attempt.completedFieldLabels : Array.isArray(attempt.completed_field_labels) ? attempt.completed_field_labels : [],
          missingDetails: Array.isArray(attempt.missingDetails) ? attempt.missingDetails : Array.isArray(attempt.missing_details) ? attempt.missing_details : [],
          completedDetails: Array.isArray(attempt.completedDetails) ? attempt.completedDetails : Array.isArray(attempt.completed_details) ? attempt.completed_details : [],
        })))
      } else {
        console.error('✗ Error en respuesta:', response.status, response.statusText)
      }
    } catch (error) {
      console.error('✗ Error al cargar intentos fallidos (raw):', error)
    }
  }, [canAccessFailedAlerts])

  // Efecto para cargar intentos fallidos inicialmente y configurar intervalos
  React.useEffect(() => {
    if (!canAccessFailedAlerts) {
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
  }, [canAccessFailedAlerts, loadFailedAttempts])

  // Efecto para recargar alertas cuando se abre el diálogo
  React.useEffect(() => {
    if (alertsOpen && canAccessFailedAlerts) {
      console.log('📋 Diálogo de alertas abierto, recargando...')
      loadFailedAttempts()
    }
  }, [alertsOpen, canAccessFailedAlerts, loadFailedAttempts])

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

  const handleAvatarSave = async (avatar: AvatarData) => {
    // Si lanza, el editor mostrará el error en línea; el toast solo corre en éxito.
    await updateCurrentUserAvatar(avatar)
    toast.success('Avatar actualizado correctamente.')
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
          className="group flex items-center gap-2.5 rounded-2xl px-2 py-1.5 text-left transition-colors duration-200 hover:bg-primary/5"
        >
          <div className="rounded-2xl bg-background/90 p-1 shadow-sm ring-1 ring-border transition-transform duration-200 group-hover:scale-105">
            <img src="/intelasist.png" alt="INTELASIST" className="h-11 w-11 shrink-0 object-contain" />
          </div>
          <div className="leading-tight group-data-[collapsible=icon]:hidden">
            <span className="block text-sm font-bold tracking-tight">
              <span className="brand-text">INTELASIST</span>
            </span>
            <span className="block text-[10px] font-medium italic tracking-[0.18em] text-muted-foreground">
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
          <SidebarGroupLabel>Principal</SidebarGroupLabel>
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
                      className="relative rounded-xl transition-all duration-200 before:absolute before:left-0 before:top-1/2 before:h-5 before:w-1 before:-translate-y-1/2 before:rounded-full before:bg-primary before:opacity-0 before:transition-opacity before:content-[''] hover:bg-primary/5 data-[active=true]:bg-primary/10 data-[active=true]:font-medium data-[active=true]:text-foreground data-[active=true]:before:opacity-100"
                    >
                      <Icon className="shrink-0" />
                      <span>{label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-2">
          <SidebarGroupLabel>Acciones</SidebarGroupLabel>
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
              {canViewAlerts ? (
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

        {/* Acceso al panel controlado por el permiso granular `manage_permissions`,
            no por el rol Support. Cualquier rol al que se le otorgue ese permiso
            verá y podrá gestionar el panel. */}
        {canViewAdminModule ? (
          <SidebarGroup className="mt-2">
            <SidebarGroupLabel>Administración</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    tooltip="Gestion de Permisos"
                    onClick={() => navigate('/admin/permisos')}
                    className="rounded-xl bg-purple-500/10 text-purple-600 font-medium transition-colors duration-150 hover:bg-purple-500/20 hover:text-purple-700 hover:shadow-[0_0_20px_rgba(168,85,247,0.18)]"
                  >
                    <Settings className="transition-transform duration-150 group-hover:scale-105" />
                    <span className="transition-colors duration-150 group-hover:drop-shadow-[0_0_10px_rgba(168,85,247,0.28)]"> Gestion de Permisos</span>
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
          <button
            type="button"
            onClick={() => openProfile(true)}
            title="Editar perfil y avatar"
            className="shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          >
            <UserAvatar
              avatar={avatarData}
              name={displayName}
              fallbackImageUrl={avatarUrl}
              size={36}
              className="border border-white/40 shadow-sm transition-transform duration-150 hover:scale-105 hover:shadow-[0_0_18px_rgba(59,130,246,0.22)]"
            />
          </button>
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
          <DialogContent className="sm:max-w-2xl max-h-[88vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Perfil del usuario</DialogTitle>
              <DialogDescription>
                Actualiza tu nombre y personaliza tu avatar (foto o personaje).
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5 py-1">
              <div className="grid gap-4 sm:grid-cols-2">
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
              </div>

              <div className="flex justify-end">
                <Button size="sm" onClick={handleProfileSave} disabled={profileSaving}>
                  {profileSaving ? 'Guardando...' : 'Guardar nombre'}
                </Button>
              </div>

              {profileMessage ? (
                <p className="text-sm text-muted-foreground bg-muted/60 px-3 py-2 rounded-md">
                  {profileMessage}
                </p>
              ) : null}

              <div className="relative">
                <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />
              </div>

              <div className="space-y-3">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Avatar de perfil</h3>
                  <p className="text-xs text-muted-foreground">
                    Personaliza color de piel, ojos, cejas, cabello y más, o sube una imagen.
                  </p>
                </div>

                <ProfileAvatarEditor
                  value={avatarData}
                  displayName={displayName}
                  canCustomize={canCustomizeAvatar}
                  canUploadImage={canUploadAvatarImage}
                  onSave={handleAvatarSave}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => openProfile(false)} disabled={profileSaving}>
                Cerrar
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

                        <div className="mt-2 space-y-2">
                          <div className="rounded-md border border-emerald-200 bg-emerald-50/70 p-2">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Campos completados</p>
                            <ul className="mt-1 space-y-1 text-xs text-emerald-900">
                              {((Array.isArray(attempt.completedDetails) && attempt.completedDetails.length > 0)
                                ? attempt.completedDetails
                                : (Array.isArray(attempt.completedFieldLabels) && attempt.completedFieldLabels.length > 0
                                  ? attempt.completedFieldLabels.map((label: string) => ({ label, value: 'Sin diligenciar' }))
                                  : [])
                              ).length > 0 ? (
                                (Array.isArray(attempt.completedDetails) && attempt.completedDetails.length > 0
                                  ? attempt.completedDetails
                                  : (Array.isArray(attempt.completedFieldLabels) && attempt.completedFieldLabels.length > 0
                                    ? attempt.completedFieldLabels.map((label: string) => ({ label, value: 'Sin diligenciar' }))
                                    : [])
                                ).map((item: any, index: number) => (
                                  <li key={`${item.field ?? item.label}-${index}`} className="break-words">
                                    <span className="font-medium">{item.label}</span>
                                    {item.value ? <span className="ml-1 text-emerald-950">: {item.value}</span> : null}
                                  </li>
                                ))
                              ) : (
                                <li className="text-muted-foreground">Ninguno</li>
                              )}
                            </ul>
                          </div>

                          <div className="rounded-md border border-amber-200 bg-amber-50/70 p-2">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">Campos incompletos</p>
                            <ul className="mt-1 space-y-1 text-xs text-amber-900">
                              {((Array.isArray(attempt.missingDetails) && attempt.missingDetails.length > 0)
                                ? attempt.missingDetails
                                : (Array.isArray(attempt.missingFieldLabels) && attempt.missingFieldLabels.length > 0
                                  ? attempt.missingFieldLabels.map((label: string) => ({ label, value: 'Sin diligenciar' }))
                                  : [])
                              ).length > 0 ? (
                                (Array.isArray(attempt.missingDetails) && attempt.missingDetails.length > 0
                                  ? attempt.missingDetails
                                  : (Array.isArray(attempt.missingFieldLabels) && attempt.missingFieldLabels.length > 0
                                    ? attempt.missingFieldLabels.map((label: string) => ({ label, value: 'Sin diligenciar' }))
                                    : [])
                                ).map((item: any, index: number) => (
                                  <li key={`${item.field ?? item.label}-${index}`} className="break-words">
                                    <span className="font-medium">{item.label}</span>
                                    {item.value ? <span className="ml-1 text-amber-950">: {item.value}</span> : null}
                                  </li>
                                ))
                              ) : (
                                <li className="text-muted-foreground">Ninguno</li>
                              )}
                            </ul>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{new Date(attempt.attemptedAt).toLocaleString('es-ES')}</span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteAttempt(attempt.id)}
                          className="ml-2"
                          disabled={!canManageAlerts}
                          title={canManageAlerts ? 'Borrar alerta' : 'No tienes permiso para borrar alertas'}
                        >
                          Borrar
                        </Button>
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
