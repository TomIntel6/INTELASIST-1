import { supabase, getDefaultApiBase } from '@/lib/supabase'
import { AUDIT_ACTIONS_MAP, type AuditLog } from '@/lib/permissions'

const API_BASE = getDefaultApiBase()

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
   * Log an audit event. We first try the Supabase RPC, and if the RPC is missing
   * (such as a 404 from the deployed database), we fall back to the backend API so
   * the app keeps working and the audit trail is still recorded.
   */
  static async logEvent(data: AuditEventData) {
    try {
      const {
        action,
        module,
        entityId,
        entityType,
        oldValues,
        newValues,
        status = 'success',
        errorMessage,
      } = data

      // Get current user info for audit logging
      const { data: authData } = await supabase.auth.getUser()
      const currentUser = authData?.user
      const userId = currentUser?.id || null
      const userEmail = currentUser?.email || null
      const userName = currentUser?.user_metadata?.full_name || null

      const { error } = await supabase.rpc('log_audit_event', {
        p_action: AUDIT_ACTIONS_MAP[action],
        p_module: module,
        p_entity_id: entityId || null,
        p_entity_type: entityType || null,
        p_old_values: oldValues ? JSON.stringify(oldValues) : null,
        p_new_values: newValues ? JSON.stringify(newValues) : null,
        p_status: status,
        p_error_message: errorMessage || null,
      })

      if (!error) {
        return true
      }

      const errorMessageText = String(error?.message || '')
      const isMissingRpc =
        error?.code === 'PGRST301' ||
        error?.code === 'PGRST404' ||
        /not found|does not exist|function .* not found|rpc.*not found/i.test(errorMessageText)

      if (!isMissingRpc) {
        console.error('Error logging audit event via RPC:', error)
        return false
      }

      // Fallback to backend API - include user info
      const fallbackResponse = await fetch(`${API_BASE}/api/audit-logs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: AUDIT_ACTIONS_MAP[action],
          module,
          entityId,
          entityType,
          oldValues,
          newValues,
          status,
          errorMessage,
          userId,
          userEmail,
          userName,
        }),
      })

      if (!fallbackResponse.ok) {
        throw new Error(`Audit fallback failed with status ${fallbackResponse.status}`)
      }

      const fallbackResult = await fallbackResponse.json().catch(() => ({}))
      return fallbackResult?.success !== false
    } catch (error) {
      console.error('Error logging audit event:', error)
      return false
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
   * Fetch audit logs with filters (usando backend API)
   */
  static async fetchAuditLogs(filters?: {
    userId?: string
    userEmail?: string
    module?: string
    action?: string
    entityId?: string
    startDate?: string
    endDate?: string
    limit?: number
    offset?: number
  }) {
    try {
      const params = new URLSearchParams()
      if (filters?.limit) params.append('limit', String(filters.limit))
      if (filters?.offset) params.append('offset', String(filters.offset))
      if (filters?.userId) params.append('userId', filters.userId)
      if (filters?.userEmail) params.append('userEmail', filters.userEmail)
      if (filters?.module) params.append('module', filters.module)
      if (filters?.action) params.append('action', filters.action)

      const response = await fetch(`${API_BASE}/api/audit-logs?${params.toString()}`)
      if (!response.ok) throw new Error('Failed to fetch audit logs')

      const result = await response.json()
      return {
        data: (result.data || []).map((row: any) => ({
          id: row.id,
          user_id: row.user_id,
          user_email: row.user_email,
          user_name: row.user_name,
          action: row.action,
          module: row.module,
          entity_id: row.entity_id,
          entity_type: row.entity_type,
          old_values: row.old_values,
          new_values: row.new_values,
          status: row.status,
          error_message: row.error_message,
          created_at: row.created_at,
        })),
        count: result.count || 0,
      }
    } catch (error) {
      console.error('Error fetching audit logs:', error)
      return { data: [], count: 0 }
    }
  }
}
