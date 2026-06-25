import * as React from 'react'
import type { ModuleKey, PermissionKey } from '@/lib/permissions'
import { PERMISSION_LABELS, PERMISSION_MODULES } from '@/lib/permissions'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { ChevronDown, ShieldAlert } from 'lucide-react'

interface Props {
  userId: string
  permissions: Record<PermissionKey, boolean>
  onChange: (permission: PermissionKey, value: boolean) => void
  onToggleModule: (moduleKey: ModuleKey, nextValue: boolean) => void
}

/**
 * Identidad visual por categoría. El punto de color solo identifica el módulo;
 * NO comunica estado (el estado on/off lo comunica el Switch + el contador).
 */
const CATEGORY_STYLES: Record<ModuleKey, { dot: string; bar: string }> = {
  reports: { dot: 'bg-blue-500', bar: 'bg-blue-500' },
  evidence: { dot: 'bg-teal-500', bar: 'bg-teal-500' },
  updates: { dot: 'bg-violet-500', bar: 'bg-violet-500' },
  users: { dot: 'bg-amber-500', bar: 'bg-amber-500' },
  system: { dot: 'bg-rose-500', bar: 'bg-rose-500' },
  admin: { dot: 'bg-fuchsia-500', bar: 'bg-fuchsia-500' },
  profile: { dot: 'bg-cyan-500', bar: 'bg-cyan-500' },
}

/**
 * Permisos de alto impacto (destructivos / sensibles). Reciben una advertencia
 * visual ámbar para diferenciarlos de un permiso operativo normal.
 */
const SENSITIVE_PERMISSIONS = new Set<PermissionKey>([
  'delete_reports',
  'permanently_delete_reports',
  'delete_evidence',
  'delete_updates',
  'delete_users',
  'reset_passwords',
  'change_roles',
  'suspend_users',
  'restore_users',
  'access_trash',
  'manage_permissions',
])

const moduleEntries = Object.entries(PERMISSION_MODULES) as Array<
  [ModuleKey, (typeof PERMISSION_MODULES)[ModuleKey]]
>

export default function PermissionsEditor({ userId, permissions, onChange, onToggleModule }: Props) {
  // Por defecto todas las categorías abiertas para que el usuario vea el panorama completo.
  const [openModules, setOpenModules] = React.useState<Set<ModuleKey>>(
    () => new Set(moduleEntries.map(([key]) => key))
  )

  const toggleOpen = (key: ModuleKey) => {
    setOpenModules((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-3">
        {moduleEntries.map(([moduleKey, moduleData]) => {
          const perms = Object.values(moduleData.permissions) as PermissionKey[]
          const total = perms.length
          const active = perms.filter((p) => permissions[p]).length
          const allActive = active === total
          const noneActive = active === 0
          const isOpen = openModules.has(moduleKey)
          const styles = CATEGORY_STYLES[moduleKey]
          const pct = total === 0 ? 0 : Math.round((active / total) * 100)
          const contentId = `${userId}-${moduleKey}-content`

          return (
            <section
              key={moduleKey}
              className="overflow-hidden rounded-xl border bg-card shadow-sm transition-shadow hover:shadow-md"
            >
              {/* ── Cabecera de categoría (toggle colapsable) ── */}
              <button
                type="button"
                onClick={() => toggleOpen(moduleKey)}
                aria-expanded={isOpen}
                aria-controls={contentId}
                className="flex w-full items-center gap-3 px-4 py-3 text-left outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset"
              >
                <span className={cn('size-2.5 shrink-0 rounded-full', styles.dot)} aria-hidden="true" />

                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold text-foreground">{moduleData.label}</span>
                  {/* Barra de progreso de cobertura del módulo */}
                  <span className="mt-1.5 flex items-center gap-2">
                    <span className="h-1.5 w-24 overflow-hidden rounded-full bg-muted-foreground/20" aria-hidden="true">
                      <span
                        className={cn('block h-full rounded-full transition-[width] duration-300 ease-out', styles.bar)}
                        style={{ width: `${pct}%` }}
                      />
                    </span>
                  </span>
                </span>

                {/* Contador X/Y activos */}
                <span
                  className={cn(
                    'shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums',
                    noneActive
                      ? 'bg-muted text-muted-foreground'
                      : allActive
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400'
                        : 'bg-accent text-foreground/80'
                  )}
                >
                  {active}/{total} activos
                </span>

                <ChevronDown
                  className={cn(
                    'size-4 shrink-0 text-muted-foreground transition-transform duration-200',
                    isOpen && 'rotate-180'
                  )}
                  aria-hidden="true"
                />
              </button>

              {/* ── Contenido colapsable (animación height vía grid-rows) ── */}
              <div
                id={contentId}
                className={cn(
                  'grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none',
                  isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                )}
              >
                <div className="overflow-hidden">
                  <div className="space-y-3 border-t px-4 py-3">
                    {/* Toolbar: activar / desactivar todo el módulo */}
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        disabled={allActive}
                        onClick={() => onToggleModule(moduleKey, true)}
                      >
                        Activar todo
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        disabled={noneActive}
                        onClick={() => onToggleModule(moduleKey, false)}
                      >
                        Desactivar todo
                      </Button>
                    </div>

                    {/* Grid de permisos: 1 columna en móvil, 2 en ≥sm */}
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {perms.map((perm) => {
                        const checked = Boolean(permissions[perm])
                        const sensitive = SENSITIVE_PERMISSIONS.has(perm)
                        const inputId = `${userId}-${perm}`
                        return (
                          <label
                            key={perm}
                            htmlFor={inputId}
                            className={cn(
                              'group/perm flex cursor-pointer items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2.5 transition-colors',
                              'hover:border-foreground/20 hover:bg-accent',
                              'focus-within:ring-2 focus-within:ring-ring/50',
                              sensitive && checked && 'border-amber-300/70 dark:border-amber-500/40'
                            )}
                          >
                            <span className="flex min-w-0 items-center gap-1.5">
                              <span className="truncate text-sm font-medium text-foreground">
                                {PERMISSION_LABELS[perm]}
                              </span>
                              {sensitive && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <ShieldAlert
                                      className="size-3.5 shrink-0 text-amber-500"
                                      aria-label="Permiso sensible de alto impacto"
                                    />
                                  </TooltipTrigger>
                                  <TooltipContent>Permiso sensible: acción de alto impacto</TooltipContent>
                                </Tooltip>
                              )}
                            </span>
                            <Switch
                              id={inputId}
                              checked={checked}
                              onCheckedChange={(v) => onChange(perm, Boolean(v))}
                              // Estado OFF = neutro (no rojo). Rojo se reserva para acciones destructivas.
                              className="shrink-0 data-[state=unchecked]:bg-muted-foreground/30 dark:data-[state=unchecked]:bg-muted-foreground/30"
                            />
                          </label>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )
        })}
      </div>
    </TooltipProvider>
  )
}
