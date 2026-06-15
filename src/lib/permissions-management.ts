import { supabase } from '@/lib/supabase'
import type { PermissionKey } from '@/lib/permissions'
import { PERMISSIONS, DEFAULT_ROLE_PERMISSIONS, getAllPermissionKeys } from '@/lib/permissions'
import type { UserRole } from '@/lib/auth'
import { AuditService } from '@/lib/audit-service'

export interface UserPermissionData {
  userId: string
  permissions: Record<PermissionKey, boolean>
}

/**
 * Service for managing user permissions
 * Handles CRUD operations for granular permissions
 */
export class PermissionsManagementService {
  /**
   * Get all available permission keys
   */
  static getAllPermissions(): PermissionKey[] {
    return getAllPermissionKeys()
  }

  /**
   * Get permissions for a user
   */
  static async getUserPermissions(userId: string) {
    try {
      // Get or create permission record
      let { data: permRecord, error: permError } = await supabase
        .from('user_permissions')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle()

      if (permError && permError.code !== 'PGRST116') {
        throw permError
      }

      if (!permRecord) {
        // Create default permissions
        const { data: created, error: createError } = await supabase
          .from('user_permissions')
          .insert({ user_id: userId })
          .select('id')
          .single()

        if (createError) throw createError
        permRecord = created
      }

      // Get all permission details
      const { data: permDetails, error: detailsError } = await supabase
        .from('user_permission_details')
        .select('permission_key, granted')
        .eq('permission_id', permRecord.id)

      if (detailsError) throw detailsError

      const permissions: Record<string, boolean> = {}

      // Initialize all permissions to false
      this.getAllPermissions().forEach((perm) => {
        permissions[perm] = false
      })

      // Set from database
      permDetails?.forEach((detail: any) => {
        permissions[detail.permission_key] = detail.granted
      })

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
      // Get or create permission record
      let { data: permRecord } = await supabase
        .from('user_permissions')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle()

      if (!permRecord) {
        const { data: created } = await supabase
          .from('user_permissions')
          .insert({ user_id: userId })
          .select('id')
          .single()
        permRecord = created
      }

      // Upsert permission detail
      const { error } = await supabase.from('user_permission_details').upsert(
        {
          permission_id: (permRecord as any)?.id,
          permission_key: permission,
          granted,
        },
        { onConflict: 'permission_id,permission_key' }
      )

      if (error) throw error

      return true
    } catch (error) {
      console.error('Error setting user permission:', error)
      return false
    }
  }

  /**
   * Update all permissions for a user
   */
  static async updateUserPermissions(userId: string, permissions: Record<PermissionKey, boolean>) {
    try {
      const oldPermissions = await this.getUserPermissions(userId)

      // Get or create permission record
      let { data: permRecord } = await supabase
        .from('user_permissions')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle()

      if (!permRecord) {
        const { data: created } = await supabase
          .from('user_permissions')
          .insert({ user_id: userId })
          .select('id')
          .single()
        permRecord = (created as any) || null
      }

      if (!permRecord) throw new Error('Failed to create or get permission record')

      // Delete existing permissions
      await supabase.from('user_permission_details').delete().eq('permission_id', (permRecord as any).id)

      // Insert new permissions
      const permDetails = Object.entries(permissions).map(([key, granted]) => ({
        permission_id: (permRecord as any).id,
        permission_key: key,
        granted,
      }))

      const { error } = await supabase.from('user_permission_details').insert(permDetails)

      if (error) throw error

      // Log the change
      await AuditService.logPermissionsUpdated(userId, oldPermissions, permissions)

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
