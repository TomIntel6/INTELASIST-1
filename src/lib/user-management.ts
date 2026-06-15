import { supabase } from '@/lib/supabase'
import { AuditService } from '@/lib/audit-service'

export interface UserActivityData {
  userId: string
  reportsCreated: number
  lastLogin?: string
  lastActivity?: string
  isSuspended: boolean
  suspensionReason?: string
  suspendedAt?: string
  suspendedBy?: string
}

/**
 * Service for advanced user management
 * Handles suspension, activity tracking, and user metrics
 */
export class UserManagementService {
  /**
   * Get all users with activity data
   */
  static async getAllUsersWithActivity() {
    try {
      const response = await fetch('https://intelasist.onrender.com/api/users/with-activity')
      if (!response.ok) throw new Error('Failed to fetch users')
      const users = await response.json()
      return users
    } catch (error) {
      console.error('Error getting users with activity:', error)
      return []
    }
  }

  /**
   * Get user activity data
   */
  static async getUserActivity(userId: string) {
    try {
      const response = await fetch(`https://intelasist.onrender.com/api/users/${userId}`)
      if (!response.ok) throw new Error('Failed to fetch user activity')
      const { user, activity } = await response.json()
      return {
        id: user.id,
        email: user.email,
        fullName: user.nombre,
        role: user.role,
        reportsCreated: activity.reportsCreated || 0,
        lastLogin: activity.lastLogin,
        lastActivity: activity.lastActivity,
        isSuspended: activity.isSuspended || false,
        suspensionReason: activity.suspensionReason,
        suspendedAt: activity.suspendedAt,
        suspendedBy: activity.suspendedBy,
      }
    } catch (error) {
      console.error('Error getting user activity:', error)
      return null
    }
  }

  /**
   * Suspend a user
   */
  static async suspendUser(userId: string, reason: string) {
    try {
      let { data: activity } = await supabase
        .from('user_activity_log')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle()

      if (!activity) {
        const { data: created } = await supabase
          .from('user_activity_log')
          .insert({ user_id: userId })
          .select('id')
          .single()
        activity = created
      }

      const now = new Date().toISOString()
      const { error } = await supabase
        .from('user_activity_log')
        .update({
          is_suspended: true,
          suspension_reason: reason,
          suspended_at: now,
        })
        .eq('user_id', userId)

      if (error) throw error

      // Log the action
      await AuditService.logUserSuspended(userId, reason)

      return true
    } catch (error) {
      console.error('Error suspending user:', error)
      return false
    }
  }

  /**
   * Reactivate a suspended user
   */
  static async reactivateUser(userId: string) {
    try {
      const { error } = await supabase
        .from('user_activity_log')
        .update({
          is_suspended: false,
          suspension_reason: null,
          suspended_at: null,
        })
        .eq('user_id', userId)

      if (error) throw error

      // Log the action
      await AuditService.logUserReactivated(userId)

      return true
    } catch (error) {
      console.error('Error reactivating user:', error)
      return false
    }
  }

  /**
   * Update last login time
   */
  static async updateLastLogin(userId: string) {
    try {
      let { data: activity } = await supabase
        .from('user_activity_log')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle()

      if (!activity) {
        const { data: created } = await supabase
          .from('user_activity_log')
          .insert({ user_id: userId })
          .select('id')
          .single()
        activity = created
      }

      const now = new Date().toISOString()
      const { error } = await supabase
        .from('user_activity_log')
        .update({
          last_login: now,
          last_activity: now,
        })
        .eq('user_id', userId)

      if (error) throw error

      return true
    } catch (error) {
      console.error('Error updating last login:', error)
      return false
    }
  }

  /**
   * Update last activity time
   */
  static async updateLastActivity(userId: string) {
    try {
      let { data: activity } = await supabase
        .from('user_activity_log')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle()

      if (!activity) {
        const { data: created } = await supabase
          .from('user_activity_log')
          .insert({ user_id: userId })
          .select('id')
          .single()
        activity = created
      }

      const now = new Date().toISOString()
      const { error } = await supabase
        .from('user_activity_log')
        .update({ last_activity: now })
        .eq('user_id', userId)

      if (error) throw error

      return true
    } catch (error) {
      console.error('Error updating last activity:', error)
      return false
    }
  }

  /**
   * Increment reports created count
   */
  static async incrementReportsCreated(userId: string) {
    try {
      let { data: activity } = await supabase
        .from('user_activity_log')
        .select('id, reports_created')
        .eq('user_id', userId)
        .maybeSingle()

      if (!activity) {
        const { data: created } = await supabase
          .from('user_activity_log')
          .insert({ user_id: userId, reports_created: 1 })
          .select('id, reports_created')
          .single()
        activity = created
      } else {
        const { error } = await supabase
          .from('user_activity_log')
          .update({
            reports_created: (activity.reports_created || 0) + 1,
            last_activity: new Date().toISOString(),
          })
          .eq('user_id', userId)

        if (error) throw error
      }

      return true
    } catch (error) {
      console.error('Error incrementing reports:', error)
      return false
    }
  }

  /**
   * Get user activity history from audit logs
   */
  static async getUserActivityHistory(userId: string, limit = 50, offset = 0) {
    try {
      const { data, error, count } = await supabase
        .from('audit_logs')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (error) throw error

      return { data: data || [], count: count || 0 }
    } catch (error) {
      console.error('Error getting user activity history:', error)
      return { data: [], count: 0 }
    }
  }

  /**
   * Get activity statistics
   */
  static async getActivityStatistics() {
    try {
      const response = await fetch('https://intelasist.onrender.com/api/users/statistics')
      if (!response.ok) throw new Error('Failed to fetch statistics')
      const stats = await response.json()
      return {
        totalUsers: stats.totalUsers,
        suspendedUsers: stats.suspendedUsers,
        activeUsers: stats.activeUsers,
        totalReports: stats.totalReports,
        avgReportsPerUser: stats.averageReportsPerUser,
      }
    } catch (error) {
      console.error('Error getting activity statistics:', error)
      return {
        totalUsers: 0,
        suspendedUsers: 0,
        activeUsers: 0,
        totalReports: 0,
        avgReportsPerUser: 0,
      }
    }
  }
}
