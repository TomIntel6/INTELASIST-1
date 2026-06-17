import * as React from 'react'
import { getDefaultApiBase, supabase } from '@/lib/supabase'
import { useAuth, hasAnyRole } from '@/lib/auth'
import type { UserPermission, PermissionKey, ModuleKey } from '@/lib/permissions'
import { PERMISSIONS, DEFAULT_MODULE_ACCESS, DEFAULT_ROLE_PERMISSIONS, getAllPermissionKeys, getModuleKeyForPermission } from '@/lib/permissions'

const API_BASE = getDefaultApiBase()

interface PermissionsContextValue {
  permissions: UserPermission | null
  modules: Record<ModuleKey, boolean>
  loading: boolean
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

  const normalizeModules = React.useCallback((rawModules: Record<string, any> | undefined) => {
    const normalized: Record<ModuleKey, boolean> = { ...DEFAULT_MODULE_ACCESS }

    if (rawModules && typeof rawModules === 'object') {
      Object.entries(rawModules).forEach(([key, value]) => {
        if (key in normalized) {
          normalized[key as ModuleKey] = Boolean(value)
        }
      })
    }

    return normalized
  }, [])

  const loadPermissions = React.useCallback(async () => {
    if (!user?.id) {
      setPermissions(null)
      setModules({ ...DEFAULT_MODULE_ACCESS })
      setLoading(false)
      return
    }

    try {
      setLoading(true)

      // Fetch user permissions from backend API
      const response = await fetch(`${API_BASE}/api/users/${user.id}/permissions`)
      if (!response.ok) throw new Error('Failed to fetch permissions')

      const data = await response.json()

      const modulesMap = normalizeModules(data.modules)

      if (Object.keys(data.permissions || {}).length === 0) {
        // Create default permissions based on user role
        const userRole = (user.user_metadata?.role as string) || 'Agente'
        const defaultPerms = DEFAULT_ROLE_PERMISSIONS[userRole] || DEFAULT_ROLE_PERMISSIONS.Agente

        const permissionMap: Record<string, boolean> = {}
        getAllPermissionKeys().forEach((perm) => {
          permissionMap[perm] = defaultPerms.includes(perm)
        })

        setPermissions({
          id: data.permissionId || '',
          userId: user.id,
          permissions: permissionMap as Record<PermissionKey, boolean>,
          createdAt: data.createdAt || new Date().toISOString(),
          updatedAt: data.updatedAt || new Date().toISOString(),
        })
      } else {
        // Use permissions from API
        const permissionMap: Record<string, boolean> = {}

        // Initialize all permissions to false
        getAllPermissionKeys().forEach((perm) => {
          permissionMap[perm] = false
        })

        // Set permissions from API response
        Object.assign(permissionMap, data.permissions)

        setPermissions({
          id: data.permissionId || '',
          userId: user.id,
          permissions: permissionMap as Record<PermissionKey, boolean>,
          createdAt: data.createdAt || new Date().toISOString(),
          updatedAt: data.updatedAt || new Date().toISOString(),
        })
      }

      setModules(modulesMap)
    } catch (error) {
      console.error('Error loading permissions:', error)
      setPermissions(null)
    } finally {
      setLoading(false)
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
      return modules[module] ?? DEFAULT_MODULE_ACCESS[module] ?? false
    },
    [modules]
  )

  const hasPermission = React.useCallback(
    (permission: PermissionKey): boolean => {
      const moduleKey = getModuleKeyForPermission(permission)
      if (moduleKey && !hasModuleAccess(moduleKey)) {
        return false
      }

      // Support and Admin always have all permissions
      if (user?.user_metadata?.role === 'Support' || user?.user_metadata?.role === 'Admin') {
        return true
      }
      if (!permissions) return false
      return permissions.permissions[permission] ?? false
    },
    [hasModuleAccess, permissions, user?.user_metadata?.role]
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
    permissions,
    modules,
    loading,
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
