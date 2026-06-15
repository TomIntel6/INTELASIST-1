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
      const { data, error: usersError } = await supabase.auth.admin.listUsers()

      if (usersError) throw usersError

      const users = (data?.users || []) as any[]

      const { data: activities, error: activitiesError } = await supabase
        .from('user_activity_log')
        .select('*')

      if (activitiesError) throw activitiesError

      const activitiesMap = new Map(activities?.map((a: any) => [a.user_id, a]) || [])

      return users.map((user: any) => {
        const activity = activitiesMap.get(user.id)
        return {
          id: user.id,
          email: user.email || '',
          fullName: user.user_metadata?.full_name || '',
          role: user.user_metadata?.role || 'Agente',
          reportsCreated: activity?.reports_created || 0,
          lastLogin: activity?.last_login,
          lastActivity: activity?.last_activity,
          isSuspended: activity?.is_suspended || false,
          suspensionReason: activity?.suspension_reason,
          suspendedAt: activity?.suspended_at,
          suspendedBy: activity?.suspended_by,
        }
      })
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
      const { data: user, error: userError } = await supabase.auth.admin.getUserById(userId)

      if (userError) throw userError

      let { data: activity, error: activityError } = await supabase
        .from('user_activity_log')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (activityError && activityError.code !== 'PGRST116') {
        throw activityError
      }

      if (!activity) {
        const { data: created } = await supabase
          .from('user_activity_log')
          .insert({ user_id: userId })
          .select()
          .single()
        activity = created
      }

      return {
        id: (user as any)?.user?.id || userId,
        email: (user as any)?.user?.email || '',
        fullName: (user as any)?.user?.user_metadata?.full_name || '',
        role: (user as any)?.user?.user_metadata?.role || 'Agente',
        reportsCreated: activity?.reports_created || 0,
        lastLogin: activity?.last_login,
        lastActivity: activity?.last_activity,
        isSuspended: activity?.is_suspended || false,
        suspensionReason: activity?.suspension_reason,
        suspendedAt: activity?.suspended_at,
        suspendedBy: activity?.suspended_by,
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
        .single()

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
        .single()

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
        .single()

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
        .single()

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
      const { data: users, error: usersError } = await supabase.auth.admin.listUsers()

      if (usersError) throw usersError

      const { data: activities, error: activitiesError } = await supabase
        .from('user_activity_log')
        .select('*')

      if (activitiesError) throw activitiesError

      const totalUsers = users?.users.length || 0
      const suspendedUsers = activities?.filter((a) => a.is_suspended).length || 0
      const totalReports = activities?.reduce((sum, a) => sum + (a.reports_created || 0), 0) || 0

      return {
        totalUsers,
        suspendedUsers,
        activeUsers: totalUsers - suspendedUsers,
        totalReports,
        avgReportsPerUser: totalUsers > 0 ? Math.round((totalReports / totalUsers) * 100) / 100 : 0,
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
