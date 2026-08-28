/**
 * Permission types and constants for the Advanced Administration system
 */

export const PERMISSIONS = {
  // Reports permissions (10)
  REPORTS: {
    CREATE: 'create_reports',
    VIEW: 'view_reports',
    VIEW_ALL: 'view_all_reports',
    EDIT: 'edit_reports',
    DELETE: 'delete_reports',
    CLOSE: 'close_reports',
    REOPEN: 'reopen_reports',
    CHANGE_STATUS: 'change_report_status',
    ASSIGN: 'assign_reports',
    EXPORT: 'export_reports',
  },
  // Evidence permissions (3)
  EVIDENCE: {
    UPLOAD: 'upload_evidence',
    DELETE: 'delete_evidence',
    DOWNLOAD: 'download_evidence',
  },
  // Updates permissions (3)
  UPDATES: {
    ADD: 'add_updates',
    EDIT: 'edit_updates',
    DELETE: 'delete_updates',
  },
  // Users permissions (5)
  USERS: {
    VIEW: 'view_users',
    CREATE: 'create_users',
    DELETE: 'delete_users',
    RESET_PASSWORD: 'reset_passwords',
    CHANGE_ROLE: 'change_roles',
  },
  // System permissions (4)
  SYSTEM: {
    VIEW_ALERTS: 'view_alerts',
    MANAGE_ALERTS: 'manage_alerts',
    VIEW_AUDIT_LOGS: 'view_audit_logs',
    MANAGE_PERMISSIONS: 'manage_permissions',
  },
  // Administration permissions (4)
  ADMIN: {
    SUSPEND_USERS: 'suspend_users',
    RESTORE_USERS: 'restore_users',
    ACCESS_TRASH: 'access_trash',
    PERMANENTLY_DELETE_REPORTS: 'permanently_delete_reports',
  },
  // Shift permissions (1)
  SHIFTS: {
    DELETE_CLOSED: 'delete_closed_shifts',
  },
  // Profile permissions (2)
  PROFILE: {
    CUSTOMIZE_AVATAR: 'customize_avatar',
    UPLOAD_AVATAR_IMAGE: 'upload_avatar_image',
  },
} as const

type PermissionCategory = typeof PERMISSIONS[keyof typeof PERMISSIONS]

type PermissionValue<T> = T extends Record<string, infer V> ? V : never
export type PermissionKey = PermissionValue<PermissionCategory>

export interface UserPermission {
  id: string
  userId: string
  permissions: Record<PermissionKey, boolean>
  createdAt: string
  updatedAt: string
}

export interface AuditLog {
  id: string
  user_id: string | null
  user_email: string | null
  user_name: string | null
  action: string
  module: string
  entity_id?: string | null
  entity_type?: string | null
  old_values?: Record<string, any> | null
  new_values?: Record<string, any> | null
  ip_address?: string | null
  user_agent?: string | null
  status: 'success' | 'error' | null
  error_message?: string | null
  created_at: string
  details?: Record<string, any> | null
}

export interface DeletedReport {
  id: string
  report_id: string
  original_data: Record<string, any>
  deleted_by: string | null
  deleted_by_name: string | null
  deleted_by_email: string | null
  deleted_at: string
  restored_at?: string | null
  permanently_deleted_at?: string | null
  permanently_deleted_by?: string | null
  reason?: string | null
}

export interface UserActivityLog {
  id: string
  user_id: string
  reports_created: number
  last_login?: string | null
  last_activity?: string | null
  is_suspended: boolean
  suspension_reason?: string | null
  suspended_at?: string | null
  suspended_by?: string | null
  updated_at: string
}

// Default permissions for each role (backward compatible)
export const DEFAULT_ROLE_PERMISSIONS: Record<string, PermissionKey[]> = {
  Agente: [
    PERMISSIONS.REPORTS.CREATE,
    PERMISSIONS.REPORTS.VIEW,
    PERMISSIONS.REPORTS.EDIT,
    PERMISSIONS.EVIDENCE.UPLOAD,
    PERMISSIONS.EVIDENCE.DOWNLOAD,
    PERMISSIONS.UPDATES.ADD,
    PERMISSIONS.PROFILE.CUSTOMIZE_AVATAR,
  ] as PermissionKey[],
  Gerente: [
    PERMISSIONS.REPORTS.CREATE,
    PERMISSIONS.REPORTS.VIEW,
    PERMISSIONS.REPORTS.VIEW_ALL,
    PERMISSIONS.REPORTS.EDIT,
    PERMISSIONS.REPORTS.CHANGE_STATUS,
    PERMISSIONS.REPORTS.ASSIGN,
    PERMISSIONS.REPORTS.EXPORT,
    PERMISSIONS.EVIDENCE.UPLOAD,
    PERMISSIONS.EVIDENCE.DOWNLOAD,
    PERMISSIONS.UPDATES.ADD,
    PERMISSIONS.USERS.VIEW,
    PERMISSIONS.SYSTEM.VIEW_ALERTS,
    PERMISSIONS.SYSTEM.VIEW_AUDIT_LOGS,
    PERMISSIONS.PROFILE.CUSTOMIZE_AVATAR,
  ] as PermissionKey[],
  Admin: Object.values(PERMISSIONS)
    .flatMap((category) => Object.values(category)) as PermissionKey[],
  Support: Object.values(PERMISSIONS)
    .flatMap((category) => Object.values(category)) as PermissionKey[],
}

// Get all permission keys
export function getAllPermissionKeys(): PermissionKey[] {
  return Object.values(PERMISSIONS)
    .flatMap((category) => Object.values(category) as PermissionKey[])
}

// Get all permissions grouped by module for UI
export const PERMISSION_MODULES = {
  reports: {
    label: 'Informes',
    permissions: PERMISSIONS.REPORTS,
    color: 'blue',
  },
  evidence: {
    label: 'Evidencias',
    permissions: PERMISSIONS.EVIDENCE,
    color: 'green',
  },
  updates: {
    label: 'Actualizaciones',
    permissions: PERMISSIONS.UPDATES,
    color: 'purple',
  },
  users: {
    label: 'Usuarios',
    permissions: PERMISSIONS.USERS,
    color: 'orange',
  },
  system: {
    label: 'Sistema',
    permissions: PERMISSIONS.SYSTEM,
    color: 'red',
  },
  admin: {
    label: 'Administración',
    permissions: PERMISSIONS.ADMIN,
    color: 'pink',
  },
  shifts: {
    label: 'Turnos',
    permissions: PERMISSIONS.SHIFTS,
    color: 'indigo',
  },
  profile: {
    label: 'Perfil',
    permissions: PERMISSIONS.PROFILE,
    color: 'teal',
  },
} as const

export type ModuleKey = keyof typeof PERMISSION_MODULES

export const DEFAULT_MODULE_ACCESS: Record<ModuleKey, boolean> = {
  reports: true,
  evidence: true,
  updates: true,
  users: true,
  system: true,
  admin: false,
  shifts: true,
  profile: true,
}

const permissionModuleEntries = Object.entries(PERMISSION_MODULES) as Array<[ModuleKey, typeof PERMISSION_MODULES[ModuleKey]]>

const permissionToModuleMap: Record<PermissionKey, ModuleKey> = {} as Record<PermissionKey, ModuleKey>
permissionModuleEntries.forEach(([moduleKey, moduleData]) => {
  Object.values(moduleData.permissions).forEach((permission) => {
    const permissionKey = permission as PermissionKey
    permissionToModuleMap[permissionKey] = moduleKey
  })
})

export const PERMISSION_TO_MODULE: Record<PermissionKey, ModuleKey> = permissionToModuleMap

export function getModuleKeyForPermission(permission: PermissionKey): ModuleKey | undefined {
  return PERMISSION_TO_MODULE[permission]
}

// Audit action types
export const AUDIT_ACTIONS_MAP = {
  CREATE_REPORT: 'create_report',
  UPDATE_REPORT: 'update_report',
  DELETE_REPORT: 'delete_report',
  CHANGE_REPORT_STATUS: 'change_report_status',
  ADD_UPDATE: 'add_update',
  DELETE_UPDATE: 'delete_update',
  UPLOAD_EVIDENCE: 'upload_evidence',
  DELETE_EVIDENCE: 'delete_evidence',
  CREATE_USER: 'create_user',
  DELETE_USER: 'delete_user',
  RESET_PASSWORD: 'reset_password',
  CHANGE_ROLE: 'change_role',
  SUSPEND_USER: 'suspend_user',
  REACTIVATE_USER: 'reactivate_user',
  UPDATE_PERMISSIONS: 'update_permissions',
  MANAGE_ALERTS: 'manage_alerts',
  RESTORE_REPORT: 'restore_report',
  PERMANENTLY_DELETE_REPORT: 'permanently_delete_report',
  EMPTY_TRASH: 'empty_trash',
  LOGIN: 'login',
  LOGOUT: 'logout',
} as const

// For backward compatibility and iteration
export const AUDIT_ACTIONS = Object.values(AUDIT_ACTIONS_MAP)

// Map action to readable label
export const AUDIT_ACTION_LABELS: Record<string, string> = {
  create_report: 'Crear informe',
  update_report: 'Editar informe',
  delete_report: 'Eliminar informe',
  change_report_status: 'Cambiar estado',
  add_update: 'Agregar actualización',
  delete_update: 'Eliminar actualización',
  upload_evidence: 'Subir evidencia',
  delete_evidence: 'Eliminar evidencia',
  create_user: 'Crear usuario',
  delete_user: 'Eliminar usuario',
  reset_password: 'Resetear contraseña',
  change_role: 'Cambiar rol',
  suspend_user: 'Suspender usuario',
  reactivate_user: 'Reactivar usuario',
  update_permissions: 'Actualizar permisos',
  manage_alerts: 'Gestionar alertas',
  restore_report: 'Restaurar informe',
  permanently_delete_report: 'Eliminar permanentemente',
  delete_closed_shift: 'Eliminar turno cerrado',
  empty_trash: 'Vaciar papelera',
  login: 'Iniciar sesión',
  logout: 'Cerrar sesión',
}

// Permission labels for UI
export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  // Reports
  create_reports: 'Crear informes',
  view_reports: 'Ver informes propios',
  view_all_reports: 'Ver todos los informes',
  edit_reports: 'Editar informes propios',
  delete_reports: 'Eliminar informes',
  close_reports: 'Cerrar informes',
  reopen_reports: 'Reabrir informes',
  change_report_status: 'Cambiar estado de informe',
  assign_reports: 'Asignar informes',
  export_reports: 'Exportar informes',
  // Evidence
  upload_evidence: 'Subir evidencias',
  delete_evidence: 'Eliminar evidencias',
  download_evidence: 'Descargar evidencias',
  // Updates
  add_updates: 'Agregar actualizaciones',
  edit_updates: 'Editar actualizaciones',
  delete_updates: 'Eliminar actualizaciones',
  // Users
  view_users: 'Ver usuarios',
  create_users: 'Crear usuarios',
  delete_users: 'Eliminar usuarios',
  reset_passwords: 'Resetear contraseñas',
  change_roles: 'Cambiar roles',
  // System
  view_alerts: 'Ver alertas',
  manage_alerts: 'Gestionar alertas',
  view_audit_logs: 'Ver auditoría',
  manage_permissions: 'Gestionar permisos',
  // Admin
  suspend_users: 'Suspender usuarios',
  restore_users: 'Restaurar usuarios',
  access_trash: 'Acceder a papelera',
  permanently_delete_reports: 'Eliminar permanentemente',
  delete_closed_shifts: 'Eliminar turnos cerrados',
  // Profile
  customize_avatar: 'Personalizar avatar de perfil',
  upload_avatar_image: 'Subir imagen como avatar',
}
