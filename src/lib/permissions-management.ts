import { getDefaultApiBase } from '@/lib/supabase'
import type { PermissionKey } from '@/lib/permissions'
import { PERMISSIONS, DEFAULT_ROLE_PERMISSIONS, DEFAULT_MODULE_ACCESS, getAllPermissionKeys, getModuleKeyForPermission } from '@/lib/permissions'
import type { UserRole } from '@/lib/auth'
import { AuditService } from '@/lib/audit-service'

const API_BASE = getDefaultApiBase()

export interface UserPermissionData {
  userId: string
  permissions: Record<PermissionKey, boolean>
}

interface UserWithPermissionsPayload {
  email?: string
  presenceStyle?: string
  permissions?: Record<string, unknown>
}

function normalizePermissionMap(rawPermissions: Record<string, any> | undefined): Record<PermissionKey, boolean> {
  const normalized: Record<PermissionKey, boolean> = {} as Record<PermissionKey, boolean>

  getAllPermissionKeys().forEach((permission) => {
    normalized[permission] = Boolean(rawPermissions?.[permission])
  })

  return normalized
}

function normalizeModuleMap(rawModules: Record<string, any> | undefined) {
  const normalized = { ...DEFAULT_MODULE_ACCESS }

  if (rawModules && typeof rawModules === 'object') {
    Object.entries(rawModules).forEach(([key, value]) => {
      if (key in normalized) {
        normalized[key as keyof typeof normalized] = Boolean(value)
      }
    })
  }

  return normalized
}

/**
 * Service for managing user permissions
 * Handles CRUD operations for granular permissions via backend API
 */
export class PermissionsManagementService {
  /**
   * Get all available permission keys
   */
  static getAllPermissions(): PermissionKey[] {
    return getAllPermissionKeys()
  }

  /**
   * Get permissions for a user via backend API
   */
  static async getUserPermissions(userId: string): Promise<Record<PermissionKey, boolean>> {
    try {
      const response = await fetch(`${API_BASE}/api/users/${userId}/permissions`)
      if (!response.ok) throw new Error('Failed to fetch permissions')

      const data = await response.json()
      
      return normalizePermissionMap(data.permissions)
    } catch (error) {
      console.error('Error getting user permissions:', error)
      return {} as Record<PermissionKey, boolean>
    }
  }

  static async getUsersWithPermissions(): Promise<UserWithPermissionsPayload[]> {
    const response = await fetch(`${API_BASE}/api/users/with-permissions`)
    if (!response.ok) throw new Error('Failed to fetch users with permissions')

    const users = await response.json() as Array<UserWithPermissionsPayload & { permissions?: Record<string, unknown>; presenceStyle?: string }>
    return users.map((user) => ({
      ...user,
      presenceStyle: typeof user.presenceStyle === 'string' && user.presenceStyle.trim() ? user.presenceStyle : 'none',
      permissions: normalizePermissionMap(user.permissions),
    }))
  }

  static async getPresenceStyles(): Promise<Record<string, string>> {
    const users = await this.getUsersWithPermissions()
    return users.reduce<Record<string, string>>((acc: Record<string, string>, user: UserWithPermissionsPayload) => {
      const email = String(user.email || '').trim().toLowerCase()
      if (email) {
        acc[email] = user.presenceStyle || 'none'
      }
      return acc
    }, {})
  }

  static async getUsersWithModules() {
    const response = await fetch(`${API_BASE}/api/users/with-modules`)
    if (!response.ok) throw new Error('Failed to fetch users with modules')

    const users = await response.json()
    return users.map((user: any) => ({
      ...user,
      modules: normalizeModuleMap(user.modules),
    }))
  }

  static async getUserModules(userId: string) {
    const response = await fetch(`${API_BASE}/api/users/${userId}/permissions`)
    if (!response.ok) throw new Error('Failed to fetch user modules')

    const data = await response.json()
    return normalizeModuleMap(data.modules)
  }

  /**
   * Set specific permission for a user
   */
  static async setUserPermission(userId: string, permission: PermissionKey, granted: boolean) {
    try {
      const currentPerms = await this.getUserPermissions(userId)
      currentPerms[permission] = granted
      return await this.updateUserPermissions(userId, currentPerms)
    } catch (error) {
      console.error('Error setting user permission:', error)
      return false
    }
  }

  /**
   * Update all permissions for a user via backend API
   */
  static async updateUserPermissions(userId: string, permissions: Record<PermissionKey, boolean>, presenceStyle?: string) {
    try {
      const oldPermissions = await this.getUserPermissions(userId)

      const response = await fetch(`${API_BASE}/api/users/${userId}/permissions`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ permissions, presenceStyle: presenceStyle || 'none' }),
      })

      if (!response.ok) throw new Error('Failed to update permissions')

      // Log the change
      await AuditService.logPermissionsUpdated(userId, oldPermissions, permissions)

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('permissions-changed', {
          detail: { userId, permissions, timestamp: new Date().toISOString() },
        }))
        window.dispatchEvent(new CustomEvent('modules-changed', {
          detail: { userId, modules: await this.getUserModules(userId), timestamp: new Date().toISOString() },
        }))
        window.dispatchEvent(new CustomEvent('presence-style-changed', {
          detail: { userId, presenceStyle: presenceStyle || 'none', timestamp: new Date().toISOString() },
        }))
      }

      return true
    } catch (error) {
      console.error('Error updating user permissions:', error)
      return false
    }
  }

  static async updateUserModules(userId: string, modules: Record<string, boolean>) {
    try {
      const response = await fetch(`${API_BASE}/api/users/${userId}/modules`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modules }),
      })

      if (!response.ok) throw new Error('Failed to update modules')

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('modules-changed', {
          detail: { userId, modules, timestamp: new Date().toISOString() },
        }))
        window.dispatchEvent(new CustomEvent('permissions-changed', {
          detail: { userId, permissions: await this.getUserPermissions(userId), timestamp: new Date().toISOString() },
        }))
      }

      return true
    } catch (error) {
      console.error('Error updating user modules:', error)
      return false
    }
  }

  /**
   * Reset user permissions to role defaults
   */
  static async resetUserPermissionsToDefaults(userId: string, userRole: UserRole) {
    try {
      const defaultPerms = DEFAULT_ROLE_PERMISSIONS[userRole] || DEFAULT_ROLE_PERMISSIONS.Agente

      const permissions: Record<string, boolean> = {}

      this.getAllPermissions().forEach((perm) => {
        permissions[perm] = defaultPerms.includes(perm)
      })

      return await this.updateUserPermissions(userId, permissions as Record<PermissionKey, boolean>)
    } catch (error) {
      console.error('Error resetting permissions:', error)
      return false
    }
  }

  /**
   * Grant multiple permissions to a user
   */
  static async grantPermissions(userId: string, permsToGrant: PermissionKey[]) {
    try {
      const currentPerms = await this.getUserPermissions(userId)

      permsToGrant.forEach((perm) => {
        currentPerms[perm] = true
      })

      return await this.updateUserPermissions(userId, currentPerms)
    } catch (error) {
      console.error('Error granting permissions:', error)
      return false
    }
  }

  /**
   * Revoke multiple permissions from a user
   */
  static async revokePermissions(userId: string, permsToRevoke: PermissionKey[]) {
    try {
      const currentPerms = await this.getUserPermissions(userId)

      permsToRevoke.forEach((perm) => {
        currentPerms[perm] = false
      })

      return await this.updateUserPermissions(userId, currentPerms)
    } catch (error) {
      console.error('Error revoking permissions:', error)
      return false
    }
  }

  /**
   * Check if user has a specific permission
   */
  static async userHasPermission(userId: string, permission: PermissionKey): Promise<boolean> {
    try {
      const permissions = await this.getUserPermissions(userId)
      return permissions[permission] ?? false
    } catch (error) {
      console.error('Error checking permission:', error)
      return false
    }
  }
}
