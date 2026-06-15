import { supabase } from '@/lib/supabase'
import { AUDIT_ACTIONS_MAP, type AuditLog } from '@/lib/permissions'

export type { AuditLog } from '@/lib/permissions'

export interface AuditEventData {
  action: keyof typeof AUDIT_ACTIONS_MAP
  module: string
  entityId?: string
  entityType?: string
  oldValues?: Record<string, any>
  newValues?: Record<string, any>
  status?: 'success' | 'error'
  errorMessage?: string
}

/**
 * Service for logging audit events to the database
 */
export class AuditService {
  /**
   * Log an audit event to the database via RPC
   */
  static async logEvent(data: AuditEventData) {
    try {
      const { action, module, entityId, entityType, oldValues, newValues, status = 'success', errorMessage } = data

      const { data: result, error } = await supabase.rpc('log_audit_event', {
        p_action: AUDIT_ACTIONS_MAP[action],
        p_module: module,
        p_entity_id: entityId || null,
        p_entity_type: entityType || null,
        p_old_values: oldValues ? JSON.stringify(oldValues) : null,
        p_new_values: newValues ? JSON.stringify(newValues) : null,
        p_status: status,
        p_error_message: errorMessage || null,
      })

      if (error) {
        console.error('Error logging audit event:', error)
        return null
      }

      return result as string
    } catch (error) {
      console.error('Error logging audit event:', error)
      return null
    }
  }

  /**
   * Log a report creation
   */
  static async logReportCreated(reportId: string, reportData: Record<string, any>) {
    return this.logEvent({
      action: 'CREATE_REPORT',
      module: 'reports',
      entityId: reportId,
      entityType: 'report',
      newValues: reportData,
    })
  }

  /**
   * Log a report update
   */
  static async logReportUpdated(
    reportId: string,
    oldData: Record<string, any>,
    newData: Record<string, any>
  ) {
    return this.logEvent({
      action: 'UPDATE_REPORT',
      module: 'reports',
      entityId: reportId,
      entityType: 'report',
      oldValues: oldData,
      newValues: newData,
    })
  }

  /**
   * Log a report deletion
   */
  static async logReportDeleted(reportId: string, reportData: Record<string, any>) {
    return this.logEvent({
      action: 'DELETE_REPORT',
      module: 'reports',
      entityId: reportId,
      entityType: 'report',
      oldValues: reportData,
    })
  }

  /**
   * Log a status change
   */
  static async logStatusChanged(
    reportId: string,
    oldStatus: string,
    newStatus: string
  ) {
    return this.logEvent({
      action: 'CHANGE_REPORT_STATUS',
      module: 'reports',
      entityId: reportId,
      entityType: 'report',
      oldValues: { status: oldStatus },
      newValues: { status: newStatus },
    })
  }

  /**
   * Log an update/comment addition
   */
  static async logUpdateAdded(reportId: string, updateId: string, updateData: Record<string, any>) {
    return this.logEvent({
      action: 'ADD_UPDATE',
      module: 'updates',
      entityId: updateId,
      entityType: 'update',
      newValues: { ...updateData, reportId },
    })
  }

  /**
   * Log an update/comment deletion
   */
  static async logUpdateDeleted(updateId: string, updateData: Record<string, any>) {
    return this.logEvent({
      action: 'DELETE_UPDATE',
      module: 'updates',
      entityId: updateId,
      entityType: 'update',
      oldValues: updateData,
    })
  }

  /**
   * Log evidence upload
   */
  static async logEvidenceUploaded(reportId: string, evidenceData: Record<string, any>) {
    return this.logEvent({
      action: 'UPLOAD_EVIDENCE',
      module: 'evidence',
      entityId: reportId,
      entityType: 'evidence',
      newValues: evidenceData,
    })
  }

  /**
   * Log evidence deletion
   */
  static async logEvidenceDeleted(evidenceId: string, evidenceData: Record<string, any>) {
    return this.logEvent({
      action: 'DELETE_EVIDENCE',
      module: 'evidence',
      entityId: evidenceId,
      entityType: 'evidence',
      oldValues: evidenceData,
    })
  }

  /**
   * Log user creation
   */
  static async logUserCreated(userId: string, userData: Record<string, any>) {
    return this.logEvent({
      action: 'CREATE_USER',
      module: 'users',
      entityId: userId,
      entityType: 'user',
      newValues: userData,
    })
  }

  /**
   * Log user deletion
   */
  static async logUserDeleted(userId: string, userData: Record<string, any>) {
    return this.logEvent({
      action: 'DELETE_USER',
      module: 'users',
      entityId: userId,
      entityType: 'user',
      oldValues: userData,
    })
  }

  /**
   * Log password reset
   */
  static async logPasswordReset(userId: string) {
    return this.logEvent({
      action: 'RESET_PASSWORD',
      module: 'users',
      entityId: userId,
      entityType: 'user',
    })
  }

  /**
   * Log role change
   */
  static async logRoleChanged(userId: string, oldRole: string, newRole: string) {
    return this.logEvent({
      action: 'CHANGE_ROLE',
      module: 'users',
      entityId: userId,
      entityType: 'user',
      oldValues: { role: oldRole },
      newValues: { role: newRole },
    })
  }

  /**
   * Log user suspension
   */
  static async logUserSuspended(userId: string, reason: string) {
    return this.logEvent({
      action: 'SUSPEND_USER',
      module: 'users',
      entityId: userId,
      entityType: 'user',
      newValues: { reason },
    })
  }

  /**
   * Log user reactivation
   */
  static async logUserReactivated(userId: string) {
    return this.logEvent({
      action: 'REACTIVATE_USER',
      module: 'users',
      entityId: userId,
      entityType: 'user',
    })
  }

  /**
   * Log permission update
   */
  static async logPermissionsUpdated(userId: string, oldPerms: Record<string, any>, newPerms: Record<string, any>) {
    return this.logEvent({
      action: 'UPDATE_PERMISSIONS',
      module: 'system',
      entityId: userId,
      entityType: 'user_permissions',
      oldValues: oldPerms,
      newValues: newPerms,
    })
  }

  /**
   * Log report restore
   */
  static async logReportRestored(reportId: string) {
    return this.logEvent({
      action: 'RESTORE_REPORT',
      module: 'trash',
      entityId: reportId,
      entityType: 'report',
    })
  }

  /**
   * Log permanent report deletion
   */
  static async logReportPermanentlyDeleted(reportId: string) {
    return this.logEvent({
      action: 'PERMANENTLY_DELETE_REPORT',
      module: 'trash',
      entityId: reportId,
      entityType: 'report',
    })
  }

  /**
   * Log trash emptied
   */
  static async logTrashEmptied(reportCount: number) {
    return this.logEvent({
      action: 'EMPTY_TRASH',
      module: 'trash',
      newValues: { reportsDeleted: reportCount },
    })
  }

  /**
   * Fetch audit logs with filters
   */
  static async fetchAuditLogs(filters?: {
    userId?: string
    module?: string
    action?: string
    entityId?: string
    startDate?: string
    endDate?: string
    limit?: number
    offset?: number
  }) {
    try {
      let query = supabase.from('audit_logs').select('*', { count: 'exact' })

      if (filters?.userId) {
        query = query.eq('user_id', filters.userId)
      }

      if (filters?.module) {
        query = query.eq('module', filters.module)
      }

      if (filters?.action) {
        query = query.eq('action', filters.action)
      }

      if (filters?.entityId) {
        query = query.eq('entity_id', filters.entityId)
      }

      if (filters?.startDate) {
        query = query.gte('created_at', filters.startDate)
      }

      if (filters?.endDate) {
        query = query.lte('created_at', filters.endDate)
      }

      query = query.order('created_at', { ascending: false })

      if (filters?.limit) {
        query = query.limit(filters.limit)
      }

      if (filters?.offset) {
        query = query.range(filters.offset, filters.offset + (filters?.limit || 50) - 1)
      }

      const { data, error, count } = await query

      if (error) throw error

      return { data: data || [], count: count || 0 }
    } catch (error) {
      console.error('Error fetching audit logs:', error)
      return { data: [], count: 0 }
    }
  }
}
