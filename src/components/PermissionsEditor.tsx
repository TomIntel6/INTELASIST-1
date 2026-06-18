import * as React from 'react'
import type { PermissionKey } from '@/lib/permissions'
import { PERMISSION_LABELS, PERMISSION_MODULES } from '@/lib/permissions'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'

interface Props {
  userId: string
  permissions: Record<PermissionKey, boolean>
  onChange: (permission: PermissionKey, value: boolean) => void
}

export default function PermissionsEditor({ userId, permissions, onChange }: Props) {
  return (
    <div className="space-y-4">
      {Object.entries(PERMISSION_MODULES).map(([moduleKey, moduleData]) => (
        <div key={moduleKey}>
          <h4 className="font-medium text-sm text-slate-900 mb-2">{moduleData.label}</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 ml-2">
            {Object.values(moduleData.permissions).map((perm) => {
              const p = perm as PermissionKey
              return (
                <label key={p} htmlFor={`${userId}-${p}`} className="flex items-center justify-between gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 shadow-sm transition-colors hover:border-slate-300">
                  <span className="text-sm text-slate-700">{PERMISSION_LABELS[p]}</span>
                  <Switch
                    id={`${userId}-${p}`}
                    checked={Boolean(permissions[p])}
                    onCheckedChange={(v) => onChange(p, Boolean(v))}
                  />
                </label>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
