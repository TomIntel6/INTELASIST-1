import * as React from 'react'

export type UserRole = 'Agente' | 'Admin' | 'Support' | 'Gerente'

export interface LocalUser {
  id: string
  email: string
  fullName?: string
  role?: UserRole
  user_metadata: {
    full_name?: string
    role?: UserRole
    roles?: UserRole[]
    must_change_password?: boolean
    avatar_url?: string
  }
}

interface LocalSession {
  user: LocalUser
}

interface AuthContextValue {
  user: LocalUser | null
  session: LocalSession | null
  loading: boolean
  requiresPasswordChange: boolean
  signInWithEmailPassword: (email: string, password: string) => Promise<void>
  signUpWithEmailPassword: (email: string, password: string, fullName: string) => Promise<void>
  updatePassword: (newPassword: string) => Promise<void>
  updateCurrentUserRole: (role: UserRole) => Promise<void>
  updateCurrentUserProfile: (fullName: string) => Promise<void>
  signOut: () => Promise<void>
}

const USER_ROLE_OPTIONS: UserRole[] = ['Agente', 'Admin', 'Support', 'Gerente']
export const AUTH_STORAGE_KEY = 'intelasist-local-auth-session'
export const PRESENCE_STORAGE_KEY = 'intelasist-online-users'
export const PRESENCE_SYNC_STORAGE_KEY = 'intelasist-presence-sync'
export const ROLE_SYNC_STORAGE_KEY = 'intelasist-role-sync'
export const USERS_SYNC_STORAGE_KEY = 'intelasist-users-sync'
export const PRESENCE_STYLE_STORAGE_KEY = 'intelasist-presence-styles'
const PRESENCE_TTL_MS = 1000 * 45
// El heartbeat debe ser claramente más frecuente que el TTL para evitar que el
// usuario "expire" entre un latido y el siguiente (antes: 60s > 45s -> parpadeo).
const PRESENCE_SYNC_INTERVAL_MS = 1000 * 20
const getDefaultApiBase = () => {
  if (import.meta.env.VITE_API_BASE_URL) return import.meta.env.VITE_API_BASE_URL
  return 'https://intelasist.onrender.com'
}
export const API_BASE_URL = getDefaultApiBase()

interface RoleSyncMessage {
  email: string
  roles: UserRole[]
}

function persistSession(session: LocalSession | null) {
  if (typeof window === 'undefined') {
    return
  }

  if (!session) {
    window.localStorage.removeItem(AUTH_STORAGE_KEY)
    return
  }

  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session))
}

function loadSession(): LocalSession | null {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY)
    if (!raw) {
      return null
    }

    const parsed = JSON.parse(raw) as LocalSession
    if (!parsed?.user?.email || !parsed?.user?.id) {
      return null
    }

    return parsed
  } catch {
    window.localStorage.removeItem(AUTH_STORAGE_KEY)
    return null
  }
}

function isValidRole(role: unknown): role is UserRole {
  return typeof role === 'string' && USER_ROLE_OPTIONS.includes(role as UserRole)
}

function normalizeRoleList(roles: unknown): UserRole[] {
  const candidates: unknown[] = Array.isArray(roles)
    ? roles
    : typeof roles === 'string'
      ? [roles]
      : []

  if (typeof roles === 'string' && roles.trim().startsWith('[')) {
    try {
      const parsed = JSON.parse(roles) as unknown
      return normalizeRoleList(parsed)
    } catch {
      // Se continúa con el flujo normal si el texto no es JSON válido.
    }
  }

  const normalized = candidates
    .map(role => typeof role === 'string' ? role.trim() : '')
    .filter((role): role is UserRole => isValidRole(role))

  return Array.from(new Set(normalized))
}

function derivePrimaryRole(roles: UserRole[]): UserRole {
  return roles[0] ?? 'Agente'
}

function normalizeUserRecord(record: Record<string, unknown>): LocalUser | null {
  const email = typeof record.correo === 'string' ? record.correo.trim() : ''
  const id = typeof record.id === 'number' || typeof record.id === 'string' ? String(record.id) : ''

  if (!email || !id) {
    return null
  }

  const fullName = typeof record.nombre === 'string' ? record.nombre : email
  const rolesFromRecord = normalizeRoleList(record.roles)
  const roleFromRecord = isValidRole(record.rol) ? record.rol : undefined
  const roles = rolesFromRecord.length > 0
    ? rolesFromRecord
    : roleFromRecord
      ? [roleFromRecord]
      : []

  return {
    id,
    email,
    user_metadata: {
      full_name: fullName,
      role: derivePrimaryRole(roles),
      roles: roles.length > 0 ? roles : undefined,
      must_change_password: false,
    },
  }
}

async function requestJson<T>(url: string, options: RequestInit = {}): Promise<T> {
  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers ?? {}),
      },
      ...options,
    })

    const payload = await response.json().catch(() => ({}))

    if (!response.ok) {
      throw new Error((payload as { error?: string }).error || 'Error al comunicarse con el servidor.')
    }

    return payload as T
  } catch (error) {
    if (error instanceof Error) {
      throw error
    }

    throw new Error('No se pudo conectar con el servidor. Verifica que el backend esté disponible y vuelve a intentarlo.')
  }
}

async function fetchCurrentUserFromBackend(email: string): Promise<LocalUser | null> {
  try {
    const users = await requestJson<Record<string, unknown>[]>(`${API_BASE_URL}/usuarios`)
    const record = users.find(user => typeof user?.correo === 'string' && user.correo.toLowerCase() === email.toLowerCase())
    return normalizeUserRecord(record ?? {})
  } catch {
    return null
  }
}

interface StoredPresenceUser {
  userId: string
  email: string
  fullName: string
  role: UserRole
  roles: UserRole[]
  lastSeen: number
  presenceStyle?: string
}

type OnlineUserSeed = {
  id: string
  email?: string
  fullName?: string
  role?: UserRole
  presenceStyle?: string
  user_metadata?: {
    full_name?: string
    role?: UserRole
  }
}

type OnlineUsersResponse = {
  users?: StoredPresenceUser[]
}

function persistPresenceUsers(users: StoredPresenceUser[]) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(PRESENCE_STORAGE_KEY, JSON.stringify(users))
  window.localStorage.setItem(PRESENCE_SYNC_STORAGE_KEY, JSON.stringify({ updatedAt: Date.now() }))

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(PRESENCE_SYNC_STORAGE_KEY))
  }
}

function prunePresenceUsers(users: StoredPresenceUser[]) {
  const now = Date.now()

  return users
    .filter(user => now - user.lastSeen < PRESENCE_TTL_MS)
    .map(user => ({
      ...user,
      roles: Array.isArray(user.roles) ? user.roles : (user.role ? [user.role] : []),
    }))
    .sort((a, b) => b.lastSeen - a.lastSeen)
}

function sanitizePresenceUsers(users: StoredPresenceUser[]) {
  return users
    .filter(user => !user.userId.startsWith('local-created-'))
    .map(user => ({
      ...user,
      roles: Array.isArray(user.roles) ? user.roles : (user.role ? [user.role] : []),
    }))
}

function dedupePresenceUsers(users: StoredPresenceUser[]) {
  const mergedByEmail = new Map<string, StoredPresenceUser>()

  for (const user of users) {
    const email = user.email.trim().toLowerCase()
    const current = mergedByEmail.get(email)
    const normalizedUser: StoredPresenceUser = {
      ...user,
      roles: Array.isArray(user.roles) ? user.roles : (user.role ? [user.role] : []),
    }

    if (!current || user.lastSeen > current.lastSeen) {
      mergedByEmail.set(email, normalizedUser)
    }
  }

  return Array.from(mergedByEmail.values())
}

async function removePresenceFromServer(userId: string) {
  if (typeof window === 'undefined' || !userId) {
    return
  }

  const deleteUrl = `${API_BASE_URL}/online-users/${encodeURIComponent(userId)}`

  try {
    const response = await fetch(deleteUrl, { method: 'DELETE' })
    if (response.ok) {
      return
    }
  } catch {
    // Se intentará el fallback con sendBeacon.
  }

  if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    try {
      const payloadBlob = new Blob([JSON.stringify({ userId })], {
        type: 'application/json',
      })
      const beaconSent = navigator.sendBeacon(`${API_BASE_URL}/online-users/offline`, payloadBlob)
      if (!beaconSent) {
        console.warn('sendBeacon falló al intentar eliminar presencia remota para userId:', userId)
      }
    } catch (err) {
      console.warn('Error en sendBeacon al eliminar presencia remota:', err)
    }
  }
}

export function getOnlineUsers(): StoredPresenceUser[] {
  if (typeof window === 'undefined') {
    return []
  }

  try {
    const raw = window.localStorage.getItem(PRESENCE_STORAGE_KEY)
    if (!raw) {
      return []
    }

    const parsed = JSON.parse(raw) as StoredPresenceUser[]
    if (!Array.isArray(parsed)) {
      return []
    }

    const sanitizedUsers = sanitizePresenceUsers(parsed)
    const freshUsers = prunePresenceUsers(sanitizedUsers)
    const dedupedUsers = dedupePresenceUsers(freshUsers)

    if (dedupedUsers.length !== freshUsers.length || freshUsers.length !== sanitizedUsers.length || sanitizedUsers.length !== parsed.length) {
      persistPresenceUsers(dedupedUsers)
    }

    return dedupedUsers
  } catch {
    window.localStorage.removeItem(PRESENCE_STORAGE_KEY)
    return []
  }
}

export function mergeOnlineUsers(localUsers: StoredPresenceUser[], remoteUsers: StoredPresenceUser[]) {
  const mergedByEmail = new Map<string, StoredPresenceUser>()

  for (const user of [...localUsers, ...remoteUsers]) {
    const email = user.email.trim().toLowerCase()
    const current = mergedByEmail.get(email)
    const normalizedUser: StoredPresenceUser = {
      ...user,
      roles: Array.isArray(user.roles) ? user.roles : (user.role ? [user.role] : []),
    }

    if (!current || user.lastSeen > current.lastSeen) {
      mergedByEmail.set(email, normalizedUser)
    }
  }

  return Array.from(mergedByEmail.values()).sort((a, b) => b.lastSeen - a.lastSeen)
}

async function syncPresenceUserToServer(user: StoredPresenceUser) {
  if (typeof window === 'undefined') {
    return
  }

  const nextUsers = prunePresenceUsers([...getOnlineUsers().filter(existing => existing.userId !== user.userId), user])
  persistPresenceUsers(nextUsers)

  try {
    await requestJson(`${API_BASE_URL}/online-users`, {
      method: 'POST',
      body: JSON.stringify(user),
    })
  } catch (error) {
    console.warn('No se pudo sincronizar la presencia con el backend.', error)
  }
}

export async function fetchOnlineUsersFromServer(): Promise<StoredPresenceUser[]> {
  try {
    const payload = await requestJson<OnlineUsersResponse>(`${API_BASE_URL}/online-users`)
    const remoteUsers = Array.isArray(payload.users) ? payload.users : []
    const sanitizedUsers = sanitizePresenceUsers(remoteUsers)
    const freshUsers = prunePresenceUsers(sanitizedUsers)
    const dedupedUsers = dedupePresenceUsers(freshUsers)

    window.localStorage.setItem(PRESENCE_STORAGE_KEY, JSON.stringify(dedupedUsers))
    return dedupedUsers
  } catch (error) {
    console.warn('No se pudo obtener la presencia remota, usando la caché local.', error)
    return getOnlineUsers()
  }
}

export function upsertOnlineUser(user: (LocalUser | OnlineUserSeed) | null) {
  if (typeof window === 'undefined') {
    return
  }

  if (!user?.id) {
    return
  }

  const fullName = ('fullName' in user && typeof user.fullName === 'string' && user.fullName.trim())
    ? user.fullName
    : (typeof user.user_metadata?.full_name === 'string' && user.user_metadata.full_name.trim())
      ? user.user_metadata.full_name
      : user.email
        ? user.email
        : 'Usuario'

  const userRoles = getUserRoles(user as LocalUser)
  const primaryRole = userRoles[0] ?? 'Agente'

  const nextUser: StoredPresenceUser = {
    userId: user.id,
    email: user.email ?? '',
    fullName,
    role: primaryRole,
    roles: userRoles,
    lastSeen: Date.now(),
  }

  const lowerEmail = user.email?.trim().toLowerCase() ?? ''
  const filteredUsers = getOnlineUsers().filter(existing =>
    existing.userId !== user.id && existing.email.trim().toLowerCase() !== lowerEmail
  )
  persistPresenceUsers(prunePresenceUsers([...filteredUsers, nextUser]))
  void syncPresenceUserToServer(nextUser)
}

export async function removeOnlineUser(userId?: string | null) {
  if (typeof window === 'undefined') {
    return
  }

  const filteredUsers = userId
    ? getOnlineUsers().filter(existing => existing.userId !== userId)
    : []

  persistPresenceUsers(filteredUsers)

  if (!userId) {
    return
  }

  await removePresenceFromServer(userId)
}

export function updateStoredUserRoles(email: string, roles: UserRole[]) {
  if (typeof window === 'undefined') {
    return
  }

  const normalizedRoles = normalizeRoleList(roles)
  const nextPrimaryRole = derivePrimaryRole(normalizedRoles)
  const users = getOnlineUsers()
  const updatedUsers = users.map(existing =>
    existing.email.toLowerCase() === email.toLowerCase()
      ? {
          ...existing,
          role: nextPrimaryRole,
          roles: normalizedRoles,
          lastSeen: existing.lastSeen ?? Date.now(),
        }
      : existing
  )

  persistPresenceUsers(updatedUsers)

  const session = loadSession()
  if (session?.user?.email.toLowerCase() === email.toLowerCase()) {
    session.user.user_metadata = {
      ...session.user.user_metadata,
      role: nextPrimaryRole,
      roles: normalizedRoles.length > 0 ? normalizedRoles : undefined,
    }
    persistSession(session)
  }

  window.localStorage.setItem(ROLE_SYNC_STORAGE_KEY, JSON.stringify({
    email: email.toLowerCase(),
    roles: normalizedRoles,
    updatedAt: Date.now(),
  } satisfies RoleSyncMessage & { updatedAt: number }))

  window.dispatchEvent(new CustomEvent<RoleSyncMessage>('intelasist-role-sync', {
    detail: {
      email: email.toLowerCase(),
      roles: normalizedRoles,
    },
  }))
}

export function updateStoredUserRole(email: string, role: UserRole) {
  updateStoredUserRoles(email, [role])
}

async function syncUserToBackend(user: LocalUser | null, overrides?: { password?: string; role?: UserRole }) {
  if (!user?.email) {
    return
  }

  const resolvedRoles = normalizeRoleList(user.user_metadata?.roles)
  const primaryRole = overrides?.role ?? derivePrimaryRole(resolvedRoles.length > 0 ? resolvedRoles : [user.user_metadata?.role ?? 'Agente'])

  await requestJson(`${API_BASE_URL}/usuarios`, {
    method: 'POST',
    body: JSON.stringify({
      nombre: user.user_metadata?.full_name ?? user.email,
      correo: user.email,
      password: overrides?.password,
      rol: primaryRole,
      roles: resolvedRoles.length > 0 ? resolvedRoles : [primaryRole],
    }),
  })
}

// Nota: `syncUserToBackend` puede ser llamado en el flujo de login. El backend
// podría responder con un error cuando el usuario ya existe. Tratamos ese caso
// como no crítico para no romper el proceso de autenticación.
async function safeSyncUserToBackend(user: LocalUser | null, overrides?: { password?: string; role?: UserRole }) {
  try {
    await syncUserToBackend(user, overrides)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('Usuario ya ha sido creado') || msg.toLowerCase().includes('already exists')) {
      console.warn('Usuario ya existe en backend — sincronización ignorada:', msg)
      return
    }
    throw err
  }
}

export function getUserRoles(user: LocalUser | null): UserRole[] {
  const metadataRoles = normalizeRoleList(user?.user_metadata?.roles)
  if (metadataRoles.length > 0) {
    return metadataRoles
  }

  const metadataRole = user?.user_metadata?.role
  if (isValidRole(metadataRole)) {
    return [metadataRole]
  }

  const legacyRole = isValidRole(user?.role)
    ? user?.role
    : undefined

  if (legacyRole) {
    return [legacyRole]
  }

  return ['Agente']
}

export function getUserRole(user: LocalUser | null): UserRole {
  return getUserRoles(user)[0] ?? 'Agente'
}

export function isAdminUser(user: LocalUser | null): boolean {
  return hasAnyRole(user, ['Admin', 'Support'])
}

export function hasAnyRole(user: LocalUser | null, allowedRoles: UserRole[]): boolean {
  const userRoles = getUserRoles(user)
  return userRoles.some(role => allowedRoles.includes(role))
}

// Usuario destacado: nombre y rol con la paleta completa (arcoíris)
const RAINBOW_USER_NAMES = ['manuel barria']

export function isRainbowUser(fullName: string | null | undefined): boolean {
  if (!fullName) return false
  return RAINBOW_USER_NAMES.includes(fullName.trim().toLowerCase())
}

// Clases para el NOMBRE: solo los usuarios destacados reciben la paleta de color
export function getNameColorClasses(fullName: string | null | undefined): string {
  return isRainbowUser(fullName) ? 'rainbow-animated font-extrabold' : ''
}

export function getRoleColorClasses(role: UserRole, fullName?: string | null) {
  // Sin cuadro ni fondo: el degradado se aplica dentro del propio texto
  if (isRainbowUser(fullName)) {
    return 'rainbow-animated font-bold bg-transparent border-0'
  }

  switch (role) {
    case 'Support':
      return 'support-animated text-[9px] uppercase tracking-[0.12em] font-semibold bg-transparent border-0'
    case 'Gerente':
      return 'gerente-animated font-bold bg-transparent border-0'
    case 'Admin':
      return 'admin-animated font-bold bg-transparent border-0'
    case 'Agente':
    default:
      return 'agente-animated font-bold bg-transparent border-0'
  }
}

export type PresenceStyleKey = 'none' | 'glow' | 'pulse' | 'rainbow' | 'orbit'

export function normalizePresenceStyle(style: unknown): PresenceStyleKey {
  const normalized = typeof style === 'string' ? style.trim().toLowerCase() : 'none'

  switch (normalized) {
    case 'glow':
    case 'pulse':
    case 'rainbow':
    case 'orbit':
      return normalized
    default:
      return 'none'
  }
}

export function getPresenceStyleLabel(style: unknown): string {
  switch (normalizePresenceStyle(style)) {
    case 'glow':
      return 'Brillo'
    case 'pulse':
      return 'Pulso'
    case 'rainbow':
      return 'Arcoíris'
    case 'orbit':
      return 'Orbital'
    case 'none':
    default:
      return 'Sin animación'
  }
}

export function getPresenceStyleClasses(style: unknown): string {
  switch (normalizePresenceStyle(style)) {
    case 'glow':
      return 'presence-badge-glow'
    case 'pulse':
      return 'presence-badge-pulse'
    case 'rainbow':
      return 'presence-badge-rainbow'
    case 'orbit':
      return 'presence-badge-orbit'
    case 'none':
    default:
      return 'presence-badge-none'
  }
}

export function canDeleteReports(user: LocalUser | null): boolean {
  return hasAnyRole(user, ['Support', 'Gerente'])
}

export function canViewPasswords(user: LocalUser | null): boolean {
  return hasAnyRole(user, ['Support', 'Gerente'])
}

export function canManageAgents(user: LocalUser | null): boolean {
  return hasAnyRole(user, ['Admin', 'Support', 'Gerente'])
}

export function canDeleteUsers(user: LocalUser | null): boolean {
  return hasAnyRole(user, ['Admin', 'Support', 'Gerente'])
}

export function canCreateUsers(user: LocalUser | null): boolean {
  return hasAnyRole(user, ['Support', 'Gerente'])
}

export function canAccessAdvancedAdmin(user: LocalUser | null): boolean {
  const isAdminOrSupport = hasAnyRole(user, ['Admin', 'Support'])
  const isMbarria = String(user?.email).toLowerCase() === 'mbarria@intelasist.com'
  return isAdminOrSupport || isMbarria
}

export function passwordChangeRequired(user: LocalUser | null): boolean {
  return user?.user_metadata?.must_change_password === true
}

const AuthContext = React.createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<LocalUser | null>(null)
  const [session, setSession] = React.useState<LocalSession | null>(null)
  const [loading, setLoading] = React.useState(true)
  const requiresPasswordChange = passwordChangeRequired(user)

  React.useEffect(() => {
    const initializeSession = async () => {
      const storedSession = loadSession()
      if (!storedSession) {
        setLoading(false)
        return
      }

      setSession(storedSession)
      setUser(storedSession.user)
      upsertOnlineUser(storedSession.user)

      const backendUser = await fetchCurrentUserFromBackend(storedSession.user.email)
      if (backendUser) {
        persistCurrentUser(backendUser)
        setSession({ user: backendUser })
        setUser(backendUser)
        upsertOnlineUser(backendUser)
      }

      setLoading(false)
    }

    void initializeSession()
  }, [])

  React.useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const handleRoleSync = (event: Event) => {
      const payload = event instanceof CustomEvent ? event.detail as RoleSyncMessage | undefined : undefined
      if (!payload?.email || !user?.email || payload.email.toLowerCase() !== user.email.toLowerCase()) {
        return
      }

      const nextRoles = normalizeRoleList(payload.roles)
      const nextPrimaryRole = derivePrimaryRole(nextRoles)
      const nextUser: LocalUser = {
        ...user,
        user_metadata: {
          ...user.user_metadata,
          role: nextPrimaryRole,
          roles: nextRoles.length > 0 ? nextRoles : undefined,
        },
      }

      setUser(nextUser)
      setSession(current => current?.user.email.toLowerCase() === user.email.toLowerCase()
        ? { user: nextUser }
        : current)
      persistSession({ user: nextUser })
      upsertOnlineUser(nextUser)
    }

    const handleStorageSync = (event: StorageEvent) => {
      if (event.storageArea !== window.localStorage) {
        return
      }

      if (event.key === ROLE_SYNC_STORAGE_KEY && event.newValue) {
        try {
          const payload = JSON.parse(event.newValue) as RoleSyncMessage
          if (!payload?.email || !user?.email || payload.email.toLowerCase() !== user.email.toLowerCase()) {
            return
          }

          const nextRoles = normalizeRoleList(payload.roles)
          const nextPrimaryRole = derivePrimaryRole(nextRoles)
          const nextUser: LocalUser = {
            ...user,
            user_metadata: {
              ...user.user_metadata,
              role: nextPrimaryRole,
              roles: nextRoles.length > 0 ? nextRoles : undefined,
            },
          }

          setUser(nextUser)
          setSession(current => current?.user.email.toLowerCase() === user.email.toLowerCase()
            ? { user: nextUser }
            : current)
          persistSession({ user: nextUser })
          upsertOnlineUser(nextUser)
        } catch {
          // Ignora actualizaciones no parseables.
        }

        return
      }

      if (event.key === AUTH_STORAGE_KEY) {
        try {
          if (!event.newValue) {
            setUser(null)
            setSession(null)
            return
          }

          const nextSession = JSON.parse(event.newValue) as LocalSession
          if (!nextSession?.user?.id || !nextSession?.user?.email) {
            setUser(null)
            setSession(null)
            return
          }

          setUser(nextSession.user)
          setSession(nextSession)
          upsertOnlineUser(nextSession.user)
        } catch {
          // Ignora actualizaciones no parseables.
        }
      }
    }

    window.addEventListener('intelasist-role-sync', handleRoleSync)
    window.addEventListener('storage', handleStorageSync)

    // Conexión SSE para recibir notificaciones en tiempo real desde el backend
    let evtSource: EventSource | null = null
    try {
      evtSource = new EventSource(`${API_BASE_URL}/events`)

      evtSource.addEventListener('role-change', (ev: MessageEvent) => {
        try {
          const payload = typeof ev.data === 'string' ? JSON.parse(ev.data) : ev.data
          if (payload?.email && Array.isArray(payload.roles)) {
            updateStoredUserRoles(String(payload.email), payload.roles)
          }
        } catch (err) {
          // Ignorar payloads inválidos
        }
      })

      // Listener para cambios de permisos en tiempo real
      evtSource.addEventListener('permissions-updated', (ev: MessageEvent) => {
        try {
          const payload = typeof ev.data === 'string' ? JSON.parse(ev.data) : ev.data
          if (payload?.type === 'permissions-updated' && payload?.userId) {
            console.log('[SSE] Permisos actualizados para usuario:', payload.userId)
            // Disparar evento personalizado para notificar a los componentes
            window.dispatchEvent(new CustomEvent('permissions-changed', { detail: payload }))
          }
        } catch (err) {
          // Ignorar payloads inválidos
        }
      })

      // Listener para cambios de módulos en tiempo real
      evtSource.addEventListener('modules-updated', (ev: MessageEvent) => {
        try {
          const payload = typeof ev.data === 'string' ? JSON.parse(ev.data) : ev.data
          if (payload?.type === 'modules-updated' && payload?.userId) {
            console.log('[SSE] Módulos actualizados para usuario:', payload.userId)
            // Disparar evento personalizado para notificar a los componentes
            window.dispatchEvent(new CustomEvent('modules-changed', { detail: payload }))
          }
        } catch (err) {
          // Ignorar payloads inválidos
        }
      })

      // Fallback: mensajes genéricos
      evtSource.addEventListener('message', (ev: MessageEvent) => {
        try {
          const payload = typeof ev.data === 'string' ? JSON.parse(ev.data) : ev.data
          if (payload?.type === 'role-change' && payload?.email && Array.isArray(payload.roles)) {
            updateStoredUserRoles(String(payload.email), payload.roles)
          } else if (payload?.type === 'permissions-updated' && payload?.userId) {
            window.dispatchEvent(new CustomEvent('permissions-changed', { detail: payload }))
          } else if (payload?.type === 'modules-updated' && payload?.userId) {
            window.dispatchEvent(new CustomEvent('modules-changed', { detail: payload }))
          }
        } catch {
          // ignore
        }
      })
    } catch (err) {
      console.warn('No se pudo conectar al stream de eventos SSE:', err)
    }

    return () => {
      window.removeEventListener('intelasist-role-sync', handleRoleSync)
      window.removeEventListener('storage', handleStorageSync)
      if (evtSource) {
        try { evtSource.close() } catch { /* noop */ }
      }
    }
  }, [user])

  const presenceIntervalRef = React.useRef<number | null>(null)

  React.useEffect(() => {
    if (!user?.id) {
      return
    }

    const syncPresence = () => {
      if (document.visibilityState !== 'visible') {
        return
      }

      upsertOnlineUser(user)
    }

    const startPresenceSync = () => {
      if (presenceIntervalRef.current !== null || document.visibilityState !== 'visible') {
        return
      }

      presenceIntervalRef.current = window.setInterval(syncPresence, PRESENCE_SYNC_INTERVAL_MS)
    }

    const stopPresenceSync = () => {
      if (presenceIntervalRef.current !== null) {
        window.clearInterval(presenceIntervalRef.current)
        presenceIntervalRef.current = null
      }
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        syncPresence()
        startPresenceSync()
      } else {
        stopPresenceSync()
      }
    }

    syncPresence()
    startPresenceSync()

    window.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      stopPresenceSync()
      window.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [user])

  const persistCurrentUser = React.useCallback((nextUser: LocalUser) => {
    setUser(nextUser)
    setSession({ user: nextUser })
    persistSession({ user: nextUser })
  }, [])

  React.useEffect(() => {
    const handleUserSync = (event: Event) => {
      if (!(event instanceof CustomEvent)) return
      
      const detail = event.detail as { userId?: number; email?: string; newName?: string }
      
      // Si el usuario sincronizado es el usuario actual, actualiza su nombre
      if (user && user.email && detail.email?.toLowerCase() === user.email.toLowerCase() && detail.newName) {
        const updatedUser: LocalUser = {
          ...user,
          user_metadata: {
            ...user.user_metadata,
            full_name: detail.newName,
          },
        }
        persistCurrentUser(updatedUser)
      }
    }

    window.addEventListener(USERS_SYNC_STORAGE_KEY as any, handleUserSync)

    return () => {
      window.removeEventListener(USERS_SYNC_STORAGE_KEY as any, handleUserSync)
    }
  }, [user, persistCurrentUser])

  const signInWithEmailPassword = async (email: string, password: string) => {
    const payload = await requestJson<{ user?: Record<string, unknown>; userData?: Record<string, unknown>; must_change_password?: boolean }>(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })

    const nextUser = normalizeUserRecord((payload.user ?? payload.userData ?? {}) as Record<string, unknown>)

    if (!nextUser) {
      throw new Error('No se pudo validar la sesión.')
    }

    nextUser.user_metadata = {
      ...nextUser.user_metadata,
      must_change_password: payload.must_change_password === true,
    }

    persistCurrentUser(nextUser)
    upsertOnlineUser(nextUser)

    try {
      await safeSyncUserToBackend(nextUser)
    } catch (syncError) {
      console.warn('No se pudo sincronizar el usuario con el backend después del login.', syncError)
    }
  }

  const signUpWithEmailPassword = async (email: string, password: string, fullName: string) => {
    const payload = await requestJson<{ user?: Record<string, unknown> }>(`${API_BASE_URL}/usuarios`, {
      method: 'POST',
      body: JSON.stringify({
        nombre: fullName,
        correo: email,
        password,
        rol: 'Agente',
        requirePasswordChange: true,
      }),
    })

    const nextUser = normalizeUserRecord((payload.user ?? {}) as Record<string, unknown>)

    if (!nextUser) {
      throw new Error('No se pudo crear el usuario localmente.')
    }

    nextUser.user_metadata = {
      ...nextUser.user_metadata,
      full_name: fullName,
      role: 'Agente',
      roles: ['Agente'],
      must_change_password: true,
    }

    persistCurrentUser(nextUser)
    upsertOnlineUser(nextUser)
  }

  const updatePassword = async (newPassword: string) => {
    if (!user?.email) {
      throw new Error('No hay un usuario activo para actualizar.')
    }

    const payload = await requestJson<{ user?: Record<string, unknown> }>(`${API_BASE_URL}/usuarios/${encodeURIComponent(user.email)}/password`, {
      method: 'PUT',
      body: JSON.stringify({ password: newPassword }),
    })

    const nextUser = normalizeUserRecord((payload.user ?? {}) as Record<string, unknown>)

    if (!nextUser) {
      throw new Error('No se pudo actualizar la contraseña.')
    }

    nextUser.user_metadata = {
      ...nextUser.user_metadata,
      must_change_password: false,
    }

    persistCurrentUser(nextUser)
    upsertOnlineUser(nextUser)
  }

  const updateCurrentUserRole = React.useCallback(async (role: UserRole) => {
    if (!user) {
      return
    }

    await requestJson(`${API_BASE_URL}/usuarios/${encodeURIComponent(user.email)}/rol`, {
      method: 'PUT',
      body: JSON.stringify({ role }),
    })

    const nextUser: LocalUser = {
      ...user,
      user_metadata: {
        ...user.user_metadata,
        role,
        roles: [role],
      },
    }

    persistCurrentUser(nextUser)
    updateStoredUserRoles(nextUser.email, [role])
  }, [persistCurrentUser, user])

  const updateCurrentUserProfile = React.useCallback(async (fullName: string) => {
    if (!user) {
      return
    }

    const nextUser: LocalUser = {
      ...user,
      user_metadata: {
        ...user.user_metadata,
        full_name: fullName,
      },
    }

    // Try updating the profile using the configured API base URL.
    // Prefer updating by numeric id: fetch users and find matching record
    try {
      const registros = await requestJson<Record<string, unknown>[]>(`${API_BASE_URL}/usuarios`)
      const record = (Array.isArray(registros) ? registros : []).find(r => typeof r?.correo === 'string' && r.correo.toLowerCase() === (user.email ?? '').toLowerCase())
      const id = record && (typeof record.id === 'number' || typeof record.id === 'string') ? String(record.id) : null

      if (id) {
        await requestJson(`${API_BASE_URL}/usuarios/${encodeURIComponent(id)}`, {
          method: 'PATCH',
          body: JSON.stringify({ nombre: fullName }),
        })
      } else {
        // If no backend record exists, fall back to creating/syncing user
        await syncUserToBackend(nextUser)
      }
    } catch (err) {
      // Bubble up a descriptive error
      const msg = err instanceof Error ? err.message : String(err)
      throw new Error(`No se pudo actualizar el perfil: ${msg}`)
    }

    persistCurrentUser(nextUser)
    upsertOnlineUser(nextUser)
  }, [persistCurrentUser, user])

  const signOut = async () => {
    await removeOnlineUser(user?.id)
    setUser(null)
    setSession(null)
    persistSession(null)
  }

  return (
    <AuthContext.Provider value={{
      user,
      session,
      loading,
      requiresPasswordChange,
      signInWithEmailPassword,
      signUpWithEmailPassword,
      updatePassword,
      updateCurrentUserRole,
      updateCurrentUserProfile,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = React.useContext(AuthContext)

  if (!ctx) {
    return {
      user: null,
      session: null,
      loading: false,
      requiresPasswordChange: false,
      signInWithEmailPassword: async () => {
        throw new Error('AuthProvider no disponible')
      },
      signUpWithEmailPassword: async () => {
        throw new Error('AuthProvider no disponible')
      },
      updatePassword: async () => {
        throw new Error('AuthProvider no disponible')
      },
      updateCurrentUserRole: async () => undefined,
      updateCurrentUserProfile: async () => {},
      signOut: async () => {},
    } satisfies AuthContextValue
  }

  return ctx
}
