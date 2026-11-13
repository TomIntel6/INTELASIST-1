import * as React from 'react'
import { getDefaultApiBase } from '@/lib/supabase'
import { useAuth, hasAnyRole } from '@/lib/auth'
import type { UserPermission, PermissionKey, ModuleKey } from '@/lib/permissions'
import { PERMISSIONS, DEFAULT_MODULE_ACCESS, DEFAULT_ROLE_PERMISSIONS, getAllPermissionKeys, getModuleKeyForPermission } from '@/lib/permissions'

const API_BASE = getDefaultApiBase()
const PERMISSION_CACHE_KEY = 'intelasist-permissions-cache:'

interface PermissionSnapshot {
  permissions: UserPermission
  modules: Record<ModuleKey, boolean>
}

function normalizeModules(rawModules: unknown): Record<ModuleKey, boolean> {
  const normalized: Record<ModuleKey, boolean> = { ...DEFAULT_MODULE_ACCESS }
  if (!rawModules || typeof rawModules !== 'object') return normalized

  Object.entries(rawModules).forEach(([key, value]) => {
    if (key in normalized) {
      normalized[key as ModuleKey] = Boolean(value)
    }
  })

  return normalized
}

function readPermissionCache(userId: string): PermissionSnapshot | null {
  try {
    const raw = window.sessionStorage.getItem(`${PERMISSION_CACHE_KEY}${userId}`)
    if (!raw) return null

    const cached = JSON.parse(raw) as Partial<PermissionSnapshot>
    const cachedPermissions = cached.permissions
    if (
      cachedPermissions?.userId !== userId ||
      !cachedPermissions.permissions ||
      typeof cachedPermissions.permissions !== 'object'
    ) {
      return null
    }

    const permissionMap = Object.fromEntries(
      getAllPermissionKeys().map(permission => [
        permission,
        cachedPermissions.permissions[permission] === true,
      ])
    ) as Record<PermissionKey, boolean>

    return {
      permissions: {
        ...cachedPermissions,
        permissions: permissionMap,
      },
      modules: normalizeModules(cached.modules),
    }
  } catch (error) {
    console.warn('No se pudo leer la caché de permisos:', error)
    return null
  }
}

function savePermissionCache(userId: string, snapshot: PermissionSnapshot) {
  try {
    window.sessionStorage.setItem(`${PERMISSION_CACHE_KEY}${userId}`, JSON.stringify(snapshot))
  } catch (error) {
    console.warn('No se pudo guardar la caché de permisos:', error)
  }
}

interface PermissionsContextValue {
  permissions: UserPermission | null
  modules: Record<ModuleKey, boolean>
  loading: boolean
  loadError: string | null
  hasPermission: (permission: PermissionKey) => boolean
  hasAnyPermission: (permissions: PermissionKey[]) => boolean
  hasAllPermissions: (permissions: PermissionKey[]) => boolean
  hasModuleAccess: (module: ModuleKey) => boolean
  refreshPermissions: () => Promise<void>
  isSupport: boolean
}

const PermissionsContext = React.createContext<PermissionsContextValue | undefined>(undefined)

export function PermissionProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [permissions, setPermissions] = React.useState<UserPermission | null>(null)
  const [modules, setModules] = React.useState<Record<ModuleKey, boolean>>(() => ({ ...DEFAULT_MODULE_ACCESS }))
  const [loading, setLoading] = React.useState(true)
  const [loadErrorState, setLoadErrorState] = React.useState<{ userId: string; message: string } | null>(null)
  const permissionRequestIdRef = React.useRef(0)
  const cachedSnapshot = React.useMemo(
    () => user?.id ? readPermissionCache(user.id) : null,
    [user?.id]
  )
  const activePermissions = permissions?.userId === user?.id
    ? permissions
    : cachedSnapshot?.permissions ?? null
  const activeModules = permissions?.userId === user?.id
    ? modules
    : cachedSnapshot?.modules ?? DEFAULT_MODULE_ACCESS
  const loadError = loadErrorState && loadErrorState.userId === user?.id ? loadErrorState.message : null
  const hasPermissionSnapshot = Boolean(activePermissions && user?.id === activePermissions.userId)

  const loadPermissions = React.useCallback(async () => {
    const requestId = ++permissionRequestIdRef.current

    if (!user?.id) {
      setPermissions(null)
      setModules({ ...DEFAULT_MODULE_ACCESS })
      setLoadErrorState(null)
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setLoadErrorState(null)

      const response = await fetch(`${API_BASE}/api/users/${user.id}/permissions`)
      if (!response.ok) throw new Error('Failed to fetch permissions')

      const data = await response.json()
      if (requestId !== permissionRequestIdRef.current) return

      const hasStoredPermissions = Object.keys(data.permissions || {}).length > 0
      const userRole = (user.user_metadata?.role as string) || 'Agente'
      const defaultPerms = DEFAULT_ROLE_PERMISSIONS[userRole] || DEFAULT_ROLE_PERMISSIONS.Agente
      const permissionMap = Object.fromEntries(
        getAllPermissionKeys().map(permission => [
          permission,
          hasStoredPermissions ? data.permissions[permission] === true : defaultPerms.includes(permission),
        ])
      ) as Record<PermissionKey, boolean>
      const snapshot: PermissionSnapshot = {
        permissions: {
          id: data.permissionId || '',
          userId: user.id,
          permissions: permissionMap,
          createdAt: data.createdAt || new Date().toISOString(),
          updatedAt: data.updatedAt || new Date().toISOString(),
        },
        modules: normalizeModules(data.modules),
      }

      setPermissions(snapshot.permissions)
      setModules(snapshot.modules)
      savePermissionCache(user.id, snapshot)
    } catch (error) {
      console.error('Error loading permissions:', error)
      if (requestId === permissionRequestIdRef.current) {
        setLoadErrorState({
          userId: user.id,
          message: error instanceof Error ? error.message : 'No se pudieron cargar los permisos.',
        })
      }
    } finally {
      if (requestId === permissionRequestIdRef.current) {
        setLoading(false)
      }
    }
  }, [user?.id, user?.user_metadata?.role])

  React.useEffect(() => {
    loadPermissions()
  }, [loadPermissions])

  React.useEffect(() => {
    const handlePermissionsChanged = (event: Event) => {
      const customEvent = event as CustomEvent
      const payload = customEvent.detail
      if (!payload?.userId || payload.userId !== user?.id) {
        return
      }

      void loadPermissions()
    }

    const handleModulesChanged = (event: Event) => {
      const customEvent = event as CustomEvent
      const payload = customEvent.detail
      if (!payload?.userId || payload.userId !== user?.id) {
        return
      }

      void loadPermissions()
    }

    window.addEventListener('permissions-changed', handlePermissionsChanged)
    window.addEventListener('modules-changed', handleModulesChanged)

    return () => {
      window.removeEventListener('permissions-changed', handlePermissionsChanged)
      window.removeEventListener('modules-changed', handleModulesChanged)
    }
  }, [loadPermissions, user?.id])

  const hasModuleAccess = React.useCallback(
    (module: ModuleKey): boolean => {
      return activeModules[module] ?? DEFAULT_MODULE_ACCESS[module] ?? false
    },
    [activeModules]
  )

  const hasPermission = React.useCallback(
    (permission: PermissionKey): boolean => {
      const moduleKey = getModuleKeyForPermission(permission)
      if (moduleKey && !hasModuleAccess(moduleKey)) {
        return false
      }

      if (!activePermissions) return false
      return activePermissions.permissions[permission] ?? false
    },
    [activePermissions, hasModuleAccess]
  )

  const hasAnyPermission = React.useCallback(
    (perms: PermissionKey[]): boolean => {
      return perms.some((p) => hasPermission(p))
    },
    [hasPermission]
  )

  const hasAllPermissions = React.useCallback(
    (perms: PermissionKey[]): boolean => {
      return perms.every((p) => hasPermission(p))
    },
    [hasPermission]
  )

  const refreshPermissions = React.useCallback(async () => {
    await loadPermissions()
  }, [loadPermissions])

  const isSupport = hasAnyRole(user, ['Support']) || String(user?.email).toLowerCase() === 'mbarria@intelasist.com'

  const value: PermissionsContextValue = {
    permissions: activePermissions,
    modules: activeModules,
    loading: loading && !hasPermissionSnapshot,
    loadError,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasModuleAccess,
    refreshPermissions,
    isSupport,
  }

  return <PermissionsContext.Provider value={value}>{children}</PermissionsContext.Provider>
}

export function usePermissions(): PermissionsContextValue {
  const context = React.useContext(PermissionsContext)
  if (context === undefined) {
    throw new Error('usePermissions must be used within a PermissionProvider')
  }
  return context
}
