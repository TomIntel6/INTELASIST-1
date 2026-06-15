import { supabase } from '@/lib/supabase'
import { AuditService } from '@/lib/audit-service'

export interface TrashReport {
  id: string
  reportId: string
  originalData: Record<string, any>
  deletedBy: string | null
  deletedByName: string | null
  deletedByEmail: string | null
  deletedAt: string
  restoredAt?: string | null
  permanentlyDeletedAt?: string | null
  permanentlyDeletedBy?: string | null
  reason?: string | null
}

/**
 * Service for managing deleted reports (trash bin)
 * Handles soft-delete functionality for report recovery
 */
export class TrashService {
  /**
   * Move a report to trash (soft delete)
   */
  static async moveToTrash(reportId: string, reportData: Record<string, any>, reason?: string) {
    try {
      const { data, error } = await supabase.from('deleted_reports').insert({
        report_id: reportId,
        original_data: reportData,
        reason: reason || 'Deleted by user',
      })

      if (error) throw error

      // Log the action
      await AuditService.logReportDeleted(reportId, reportData)

      return data
    } catch (error) {
      console.error('Error moving report to trash:', error)
      throw error
    }
  }

  /**
   * Get all deleted reports (trash)
   */
  static async getTrash(limit = 50, offset = 0) {
    try {
      const { data, error, count } = await supabase
        .from('deleted_reports')
        .select('*', { count: 'exact' })
        .is('permanently_deleted_at', null)
        .is('restored_at', null)
        .order('deleted_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (error) throw error

      return { data: (data || []) as TrashReport[], count: count || 0 }
    } catch (error) {
      console.error('Error fetching trash:', error)
      return { data: [], count: 0 }
    }
  }

  /**
   * Get a single deleted report by ID
   */
  static async getDeletedReport(trashId: string) {
    try {
      const { data, error } = await supabase
        .from('deleted_reports')
        .select('*')
        .eq('id', trashId)
        .single()

      if (error && error.code !== 'PGRST116') throw error

      return (data as TrashReport) || null
    } catch (error) {
      console.error('Error fetching deleted report:', error)
      return null
    }
  }

  /**
   * Restore a report from trash
   */
  static async restoreReport(trashId: string) {
    try {
      // Get the trash record
      const trash = await this.getDeletedReport(trashId)
      if (!trash) {
        throw new Error('Deleted report not found')
      }

      const { reportId } = trash

      // Update trash record to mark as restored
      const { error: updateError } = await supabase
        .from('deleted_reports')
        .update({ restored_at: new Date().toISOString() })
        .eq('id', trashId)

      if (updateError) throw updateError

      // Log the action
      await AuditService.logReportRestored(reportId)

      return { success: true }
    } catch (error) {
      console.error('Error restoring report:', error)
      throw error
    }
  }

  /**
   * Permanently delete a report
   */
  static async permanentlyDelete(trashId: string) {
    try {
      // Get the trash record
      const trash = await this.getDeletedReport(trashId)
      if (!trash) {
        throw new Error('Deleted report not found')
      }

      const { reportId } = trash

      // Update trash record
      const { error: updateError } = await supabase
        .from('deleted_reports')
        .update({
          permanently_deleted_at: new Date().toISOString(),
        })
        .eq('id', trashId)

      if (updateError) throw updateError

      // Log the action
      await AuditService.logReportPermanentlyDeleted(reportId)

      return { success: true }
    } catch (error) {
      console.error('Error permanently deleting report:', error)
      throw error
    }
  }

  /**
   * Empty trash (mark all items as permanently deleted)
   */
  static async emptyTrash() {
    try {
      // Get all items to delete
      const { data: trashItems, error: fetchError } = await supabase
        .from('deleted_reports')
        .select('*')
        .is('permanently_deleted_at', null)
        .is('restored_at', null)

      if (fetchError) throw fetchError

      if (!trashItems || trashItems.length === 0) {
        return { success: true, count: 0 }
      }

      // Mark all as permanently deleted
      const { error: updateError } = await supabase
        .from('deleted_reports')
        .update({
          permanently_deleted_at: new Date().toISOString(),
        })
        .is('permanently_deleted_at', null)
        .is('restored_at', null)

      if (updateError) throw updateError

      // Log the action
      await AuditService.logTrashEmptied(trashItems.length)

      return { success: true, count: trashItems.length }
    } catch (error) {
      console.error('Error emptying trash:', error)
      throw error
    }
  }

  /**
   * Get trash statistics
   */
  static async getTrashStats() {
    try {
      const { count: totalDeleted } = await supabase
        .from('deleted_reports')
        .select('*', { count: 'exact' })
        .is('permanently_deleted_at', null)
        .is('restored_at', null)

      return { totalDeleted: totalDeleted || 0 }
    } catch (error) {
      console.error('Error fetching trash stats:', error)
      return { totalDeleted: 0 }
    }
  }
}
