import * as React from 'react'
import { getDefaultApiBase, supabase } from '@/lib/supabase'
import { useAuth, hasAnyRole } from '@/lib/auth'
import type { UserPermission, PermissionKey } from '@/lib/permissions'
import { PERMISSIONS, DEFAULT_ROLE_PERMISSIONS, getAllPermissionKeys } from '@/lib/permissions'

const API_BASE = getDefaultApiBase()

interface PermissionsContextValue {
  permissions: UserPermission | null
  loading: boolean
  hasPermission: (permission: PermissionKey) => boolean
  hasAnyPermission: (permissions: PermissionKey[]) => boolean
  hasAllPermissions: (permissions: PermissionKey[]) => boolean
  refreshPermissions: () => Promise<void>
  isSupport: boolean
}

const PermissionsContext = React.createContext<PermissionsContextValue | undefined>(undefined)

export function PermissionProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [permissions, setPermissions] = React.useState<UserPermission | null>(null)
  const [loading, setLoading] = React.useState(true)

  const loadPermissions = React.useCallback(async () => {
    if (!user?.id) {
      setPermissions(null)
      setLoading(false)
      return
    }

    try {
      setLoading(true)

      // Fetch user permissions from backend API
      const response = await fetch(`${API_BASE}/api/users/${user.id}/permissions`)
      if (!response.ok) throw new Error('Failed to fetch permissions')

      const data = await response.json()

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

  const hasPermission = React.useCallback(
    (permission: PermissionKey): boolean => {
      // Support and Admin always have all permissions
      if (user?.user_metadata?.role === 'Support' || user?.user_metadata?.role === 'Admin') {
        return true
      }
      if (!permissions) return false
      return permissions.permissions[permission] ?? false
    },
    [permissions, user?.user_metadata?.role]
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
    loading,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
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
