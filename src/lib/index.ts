// Export all permission-related types and utilities
export type { PermissionKey } from '@/lib/permissions'
export type { UserPermission, AuditLog, DeletedReport, UserActivityLog } from '@/lib/permissions'
export {
  PERMISSIONS,
  DEFAULT_ROLE_PERMISSIONS,
  getAllPermissionKeys,
  PERMISSION_MODULES,
  AUDIT_ACTIONS,
  AUDIT_ACTION_LABELS,
  PERMISSION_LABELS,
} from '@/lib/permissions'

// Export services
export { AuditService } from '@/lib/audit-service'
export type { AuditEventData } from '@/lib/audit-service'
export { TrashService } from '@/lib/trash-service'
export type { TrashReport } from '@/lib/trash-service'
export { PermissionsManagementService } from '@/lib/permissions-management'
export { UserManagementService } from '@/lib/user-management'

// Export context and hooks
export { PermissionProvider, usePermissions } from '@/lib/permissions-context'
export type { } from '@/lib/permissions-context'

// Export components
export { PermissionGuard, PermissionConditional, PermissionWrapper } from '@/components/PermissionGuard'
