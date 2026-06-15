import { useCallback } from 'react'
import { AuditService } from '@/lib/audit-service'
import type { AuditEventData } from '@/lib/audit-service'

/**
 * Hook para registrar eventos de auditoría
 */
export function useAudit() {
  const logEvent = useCallback(async (data: AuditEventData) => {
    try {
      return await AuditService.logEvent(data)
    } catch (error) {
      console.error('Error logging audit event:', error)
      return null
    }
  }, [])

  const logReportCreated = useCallback(
    async (reportId: string, reportData: Record<string, any>) => {
      return await AuditService.logReportCreated(reportId, reportData)
    },
    []
  )

  const logReportUpdated = useCallback(
    async (reportId: string, oldData: Record<string, any>, newData: Record<string, any>) => {
      return await AuditService.logReportUpdated(reportId, oldData, newData)
    },
    []
  )

  const logStatusChanged = useCallback(
    async (reportId: string, oldStatus: string, newStatus: string) => {
      return await AuditService.logStatusChanged(reportId, oldStatus, newStatus)
    },
    []
  )

  const logUpdateAdded = useCallback(
    async (reportId: string, updateId: string, updateData: Record<string, any>) => {
      return await AuditService.logUpdateAdded(reportId, updateId, updateData)
    },
    []
  )

  const logEvidenceUploaded = useCallback(
    async (reportId: string, evidenceData: Record<string, any>) => {
      return await AuditService.logEvidenceUploaded(reportId, evidenceData)
    },
    []
  )

  return {
    logEvent,
    logReportCreated,
    logReportUpdated,
    logStatusChanged,
    logUpdateAdded,
    logEvidenceUploaded,
  }
}
