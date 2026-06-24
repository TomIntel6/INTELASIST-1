import { getAuthHeaders } from '@/lib/auth'
import { getDefaultApiBase } from '@/lib/supabase'

const API_BASE = getDefaultApiBase()

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
  static async fetchWithAuth(path: string, options: RequestInit = {}) {
    const headers: Record<string, string> = {
      ...getAuthHeaders(),
    }

    if (options.headers) {
      if (options.headers instanceof Headers) {
        options.headers.forEach((value, key) => {
          headers[key] = value
        })
      } else if (Array.isArray(options.headers)) {
        for (const [key, value] of options.headers) {
          headers[key] = value
        }
      } else {
        Object.assign(headers, options.headers)
      }
    }

    if (options.body && !Object.keys(headers).some(key => key.toLowerCase() === 'content-type')) {
      headers['Content-Type'] = 'application/json'
    }

    // IMPORTANTE: `headers` debe ir DESPUÉS de `...options`. Si se expande
    // options al final, su propia propiedad `headers` (p. ej. Content-Type en
    // moveToTrash) sobrescribe las cabeceras ya combinadas y se pierden
    // Authorization y x-user-* → el backend responde 401.
    const response = await fetch(path, {
      ...options,
      headers,
    })

    if (response.status === 401) {
      throw new Error('Tu sesión ha expirado. Vuelve a iniciar sesión para continuar.')
    }

    return response
  }

  /**
   * Move a report to trash (soft delete)
   */
  static async moveToTrash(reportId: string, reportData: Record<string, any>, reason?: string) {
    try {
      const response = await this.fetchWithAuth(`${API_BASE}/api/trash`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reportId,
          originalData: reportData,
          reason: reason || 'Deleted by user',
        }),
      })

      if (!response.ok) throw new Error('Failed to move report to trash')

      // Backend is handling audit logging, no need to duplicate here
      console.log('[TrashService] Report moved to trash. Audit logged by backend.')

      return await response.json()
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
      const response = await this.fetchWithAuth(`${API_BASE}/api/trash?limit=${limit}&offset=${offset}`)
      if (!response.ok) throw new Error('Failed to fetch trash')
      
      const result = await response.json()
      return {
        data: (result.data || []).map((item: any) => ({
          id: item.id,
          reportId: item.report_id,
          originalData: item.original_data,
          deletedBy: item.deleted_by,
          deletedByName: item.deleted_by_name,
          deletedByEmail: item.deleted_by_email,
          deletedAt: item.deleted_at,
          restoredAt: item.restored_at,
          permanentlyDeletedAt: item.permanently_deleted_at,
          reason: item.reason,
        })) as TrashReport[],
        count: result.count || 0,
      }
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
      const response = await this.fetchWithAuth(`${API_BASE}/api/trash/${trashId}`)
      if (!response.ok) return null
      
      const item = await response.json()
      return {
        id: item.id,
        reportId: item.report_id,
        originalData: item.original_data,
        deletedBy: item.deleted_by,
        deletedByName: item.deleted_by_name,
        deletedByEmail: item.deleted_by_email,
        deletedAt: item.deleted_at,
        restoredAt: item.restored_at,
        permanentlyDeletedAt: item.permanently_deleted_at,
        reason: item.reason,
      } as TrashReport
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
      const response = await this.fetchWithAuth(`${API_BASE}/api/trash/${trashId}/restore`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      })

      if (!response.ok) throw new Error('Failed to restore report')

      // Backend is handling audit logging, no need to duplicate here
      console.log('[TrashService] Report restored. Audit logged by backend.')

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
      const response = await this.fetchWithAuth(`${API_BASE}/api/trash/${trashId}/delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      })

      if (!response.ok) throw new Error('Failed to permanently delete report')

      // Backend is handling audit logging, no need to duplicate here
      console.log('[TrashService] Report permanently deleted. Audit logged by backend.')

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
      const response = await this.fetchWithAuth(`${API_BASE}/api/trash/empty`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) throw new Error('Failed to empty trash')

      const result = await response.json()

      return { success: true, count: result.deleted_count || 0 }
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
      const response = await this.fetchWithAuth(`${API_BASE}/api/trash/stats`)
      if (!response.ok) throw new Error('Failed to fetch trash stats')
      
      const result = await response.json()
      return { totalDeleted: result.totalDeleted || 0 }
    } catch (error) {
      console.error('Error fetching trash stats:', error)
      return { totalDeleted: 0 }
    }
  }
}
