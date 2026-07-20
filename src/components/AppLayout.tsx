import * as React from 'react'
import { Outlet } from 'react-router-dom'
import { Bell, Mail, Phone, ShieldCheck, Sparkles, UserCircle2 } from 'lucide-react'
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { useAuth, getRoleColorClasses, getUserRoles } from '@/lib/auth'
import { usePermissions } from '@/lib/permissions-context'
import { normalizeAvatar } from '@/lib/avatar'
import { PERMISSIONS } from '@/lib/permissions'
import { ProfileAvatarEditor } from '@/components/ProfileAvatarEditor'
import { UserAvatar } from '@/components/UserAvatar'
import { AppSidebar } from './AppSidebar'
import { Separator } from '@/components/ui/separator'

export default function AppLayout() {
  const { user, updateCurrentUserProfile, updateCurrentUserAvatar } = useAuth()
  const { hasPermission } = usePermissions()
  const [notificationsOpen, setNotificationsOpen] = React.useState(false)
  const [profileOpen, setProfileOpen] = React.useState(false)
  const [profileName, setProfileName] = React.useState('')
  const [profileSaving, setProfileSaving] = React.useState(false)
  const [profileMessage, setProfileMessage] = React.useState<string | null>(null)

  const rawDisplayName = (user?.user_metadata?.full_name as string) ?? user?.email ?? 'Usuario'
  const displayName = profileName || rawDisplayName
  const avatarData = React.useMemo(() => normalizeAvatar(user?.user_metadata?.avatar), [user])
  const userRoles = React.useMemo(() => getUserRoles(user), [user])
  const metadata = (user?.user_metadata ?? {}) as Record<string, unknown>
  const phoneNumber = typeof metadata.phone === 'string'
    ? metadata.phone
    : typeof metadata.phone_number === 'string'
      ? metadata.phone_number
      : 'Sin teléfono asociado'
  const email = user?.email ?? 'usuario@intelassist.local'

  const canCustomizeAvatar = React.useMemo(
    () =>
      hasPermission(PERMISSIONS.PROFILE.CUSTOMIZE_AVATAR) ||
      userRoles.includes('Admin') ||
      userRoles.includes('Support'),
    [hasPermission, userRoles]
  )

  const canUploadAvatarImage = React.useMemo(
    () =>
      hasPermission(PERMISSIONS.PROFILE.UPLOAD_AVATAR_IMAGE) ||
      userRoles.includes('Admin') ||
      userRoles.includes('Support'),
    [hasPermission, userRoles]
  )

  React.useEffect(() => {
    setProfileName(rawDisplayName)
  }, [rawDisplayName])

  const handleProfileSave = async () => {
    if (!user) return

    const nextName = profileName.trim()
    if (!nextName) {
      setProfileMessage('El nombre no puede estar vacío.')
      return
    }

    setProfileSaving(true)
    setProfileMessage(null)

    try {
      await updateCurrentUserProfile(nextName)
      setProfileMessage('Perfil actualizado correctamente.')
    } catch (error) {
      setProfileMessage(error instanceof Error ? error.message : 'No se pudo actualizar el perfil.')
    } finally {
      setProfileSaving(false)
    }
  }

  const handleAvatarSave = async (avatar: ReturnType<typeof normalizeAvatar> extends infer T ? T : never) => {
    await updateCurrentUserAvatar(avatar)
  }

  function formatHeaderDate() {
    try {
      const now = new Date()
      const parts = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).formatToParts(now)
      const weekday = parts.find(p => p.type === 'weekday')?.value ?? ''
      const day = parts.find(p => p.type === 'day')?.value ?? ''
      const month = parts.find(p => p.type === 'month')?.value ?? ''
      const year = parts.find(p => p.type === 'year')?.value ?? ''
      const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
      return `${cap(weekday)} ${day} ${cap(month)} ${year}`
    } catch {
      return new Date().toLocaleDateString('es-ES')
    }
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="app-header sticky top-0 z-30 flex h-18 shrink-0 items-center gap-3 px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="h-5" />
          <div className="flex flex-1 items-center justify-between gap-3">
            <div className="flex items-center gap-4">
              <span className="brand-monogram flex size-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold tracking-tight">
                IA
              </span>
              <div className="leading-tight">
                <p className="app-greeting-name">Buenos días, {displayName}</p>
                <p className="app-greeting-subtitle">Centro de Inteligencia Operacional</p>
                <p className="app-greeting-date">{formatHeaderDate()}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 lg:gap-3">
              <div className="relative">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setNotificationsOpen(previous => !previous)}
                  className="rounded-xl border border-border/70 bg-background/70 text-muted-foreground shadow-sm transition-all hover:scale-[1.02] hover:bg-accent hover:text-foreground"
                  aria-label="Notificaciones"
                >
                  <Bell className="size-4" />
                </Button>

                {notificationsOpen ? (
                  <div className="absolute right-0 top-12 w-[280px] rounded-2xl border border-border/70 bg-background/95 p-3 shadow-[0_20px_54px_-28px_rgba(15,23,42,0.55)] backdrop-blur-sm">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold">Notificaciones</p>
                      <button
                        type="button"
                        onClick={() => setNotificationsOpen(false)}
                        className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                        aria-label="Cerrar notificaciones"
                      >
                        <span className="sr-only">Cerrar</span>
                        ×
                      </button>
                    </div>
                    <div className="mt-3 rounded-xl bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                      Sin notificaciones nuevas.
                    </div>
                  </div>
                ) : null}
              </div>

              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setProfileOpen(true)}
                className="rounded-xl border border-border/70 bg-background/70 text-muted-foreground shadow-sm transition-all hover:scale-[1.02] hover:bg-accent hover:text-foreground"
                aria-label="Perfil"
              >
                <UserCircle2 className="size-4" />
              </Button>
            </div>
          </div>
        </header>

        <Sheet open={profileOpen} onOpenChange={setProfileOpen}>
          <SheetContent side="right" className="w-[440px] max-w-[92vw] overflow-y-auto px-0 py-0">
            <SheetHeader className="border-b border-border/60 px-5 py-4">
              <SheetTitle>Perfil del usuario</SheetTitle>
              <SheetDescription>
                Información del perfil, roles y edición del avatar sin cambiar permisos.
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-4 px-5 py-4">
              <div className="rounded-[24px] border border-border/70 bg-gradient-to-br from-primary/12 via-background to-background p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="rounded-full border border-border/70 bg-background/90 p-1 shadow-sm">
                    <UserAvatar
                      avatar={avatarData}
                      name={displayName}
                      fallbackImageUrl={user?.user_metadata?.avatar_url as string | undefined}
                      size={72}
                      className="border border-border/70"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold text-foreground">{displayName}</p>
                    <p className="truncate text-xs text-muted-foreground">{email}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {userRoles.length ? userRoles.map(role => (
                        <Badge key={role} className={`text-[10px] font-semibold px-2.5 py-1 ${getRoleColorClasses(role, displayName)}`}>
                          {role.toUpperCase()}
                        </Badge>
                      )) : (
                        <Badge className="text-[10px] font-semibold px-2.5 py-1">SIN ROL</Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-3">
                <div className="rounded-2xl border border-border/70 bg-muted/40 p-3.5">
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Sparkles className="size-4 text-primary" />
                    Datos principales
                  </div>

                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="profile-name">Nombre completo</Label>
                      <Input
                        id="profile-name"
                        value={profileName}
                        onChange={(event) => setProfileName(event.target.value)}
                        placeholder="Nombre completo"
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                        <Mail className="size-3.5 text-primary" />
                        Correo electrónico
                      </div>
                      <Input id="profile-email" value={email} disabled />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                        <Phone className="size-3.5 text-primary" />
                        Teléfono
                      </div>
                      <Input id="profile-phone" value={phoneNumber} disabled />
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-border/70 bg-muted/40 p-3.5">
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                    <ShieldCheck className="size-4 text-primary" />
                    Acceso y roles
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {userRoles.map(role => (
                      <Badge key={role} className={`text-[10px] font-semibold px-2.5 py-1 ${getRoleColorClasses(role, displayName)}`}>
                        {role.toUpperCase()}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-border/70 bg-muted/40 p-3">
                <div className="mb-2 text-sm font-semibold text-foreground">Avatar de perfil</div>
                <ProfileAvatarEditor
                  value={avatarData}
                  displayName={displayName}
                  canCustomize={canCustomizeAvatar}
                  canUploadImage={canUploadAvatarImage}
                  onSave={handleAvatarSave}
                />
              </div>

              {profileMessage ? (
                <p className="rounded-xl bg-muted/55 px-3 py-2 text-sm text-muted-foreground">
                  {profileMessage}
                </p>
              ) : null}
            </div>

            <SheetFooter className="border-t border-border/60 px-5 py-4">
              <Button variant="outline" onClick={() => setProfileOpen(false)} disabled={profileSaving}>
                Cerrar
              </Button>
              <Button onClick={handleProfileSave} disabled={profileSaving}>
                {profileSaving ? 'Guardando...' : 'Guardar nombre'}
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>

        <main className="flex-1 min-w-0 overflow-auto">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
