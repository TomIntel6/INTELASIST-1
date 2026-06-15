import * as React from 'react'
import { usePermissions } from '@/lib/permissions-context'
import type { PermissionKey } from '@/lib/permissions'

interface PermissionGuardProps {
  permission?: PermissionKey | PermissionKey[]
  requiredAll?: boolean
  fallback?: React.ReactNode
  children: React.ReactNode
}

/**
 * Component that conditionally renders content based on user permissions
 *
 * @param permission - Single permission or array of permissions to check
 * @param requiredAll - If true, user must have ALL permissions (default: false = ANY permission)
 * @param fallback - Component to render if permission check fails
 * @param children - Content to render if permission check passes
 */
export function PermissionGuard({
  permission,
  requiredAll = false,
  fallback = null,
  children,
}: PermissionGuardProps) {
  const { hasPermission, hasAnyPermission, hasAllPermissions, loading } = usePermissions()

  // While loading, don't render anything
  if (loading) {
    return null
  }

  // If no permission specified, always allow
  if (!permission) {
    return <>{children}</>
  }

  let hasAccess = false

  if (Array.isArray(permission)) {
    hasAccess = requiredAll ? hasAllPermissions(permission) : hasAnyPermission(permission)
  } else {
    hasAccess = hasPermission(permission)
  }

  return <>{hasAccess ? children : fallback}</>
}

interface PermissionConditionalProps {
  permission: PermissionKey | PermissionKey[]
  requiredAll?: boolean
  renderIf: React.ReactNode
  renderElse?: React.ReactNode
}

/**
 * Alternative to PermissionGuard for conditional rendering
 */
export function PermissionConditional({
  permission,
  requiredAll = false,
  renderIf,
  renderElse = null,
}: PermissionConditionalProps) {
  const { hasPermission, hasAnyPermission, hasAllPermissions, loading } = usePermissions()

  if (loading) {
    return null
  }

  let hasAccess = false

  if (Array.isArray(permission)) {
    hasAccess = requiredAll ? hasAllPermissions(permission) : hasAnyPermission(permission)
  } else {
    hasAccess = hasPermission(permission)
  }

  return <>{hasAccess ? renderIf : renderElse}</>
}

interface PermissionWrapperProps {
  permission: PermissionKey | PermissionKey[]
  requiredAll?: boolean
  children: React.ReactElement
}

/**
 * Wrapper that disables elements based on permissions instead of hiding them
 */
export function PermissionWrapper({
  permission,
  requiredAll = false,
  children,
}: PermissionWrapperProps) {
  const { hasPermission, hasAnyPermission, hasAllPermissions, loading } = usePermissions()

  if (loading) {
    return children
  }

  let hasAccess = false

  if (Array.isArray(permission)) {
    hasAccess = requiredAll ? hasAllPermissions(permission) : hasAnyPermission(permission)
  } else {
    hasAccess = hasPermission(permission)
  }

  if (hasAccess) {
    return children
  }

  // Return disabled version of the element
  return React.cloneElement(children, {
    disabled: true,
    title: 'No tienes permiso para esta acción',
  } as any)
}
