import { getDefaultApiBase } from '@/lib/supabase'
import type { PermissionKey } from '@/lib/permissions'
import { PERMISSIONS, DEFAULT_ROLE_PERMISSIONS, getAllPermissionKeys } from '@/lib/permissions'
import type { UserRole } from '@/lib/auth'
import { AuditService } from '@/lib/audit-service'

const API_BASE = getDefaultApiBase()

export interface UserPermissionData {
  userId: string
  permissions: Record<PermissionKey, boolean>
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
  static async getUserPermissions(userId: string) {
    try {
      const response = await fetch(`${API_BASE}/api/users/${userId}/permissions`)
      if (!response.ok) throw new Error('Failed to fetch permissions')

      const data = await response.json()
      
      const permissions: Record<string, boolean> = {}
      
      // Initialize all permissions to false
      this.getAllPermissions().forEach((perm) => {
        permissions[perm] = false
      })

      // Set from API response
      if (data.permissions) {
        Object.assign(permissions, data.permissions)
      }

      return permissions
    } catch (error) {
      console.error('Error getting user permissions:', error)
      return {}
    }
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
  static async updateUserPermissions(userId: string, permissions: Record<PermissionKey, boolean>) {
    try {
      const oldPermissions = await this.getUserPermissions(userId)

      const response = await fetch(`${API_BASE}/api/users/${userId}/permissions`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ permissions }),
      })

      if (!response.ok) throw new Error('Failed to update permissions')

      // Log the change
      await AuditService.logPermissionsUpdated(userId, oldPermissions, permissions)

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('permissions-changed', {
          detail: { userId, permissions, timestamp: new Date().toISOString() },
        }))
      }

      return true
    } catch (error) {
      console.error('Error updating user permissions:', error)
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
