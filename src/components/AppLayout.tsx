import * as React from 'react'
import { Outlet } from 'react-router-dom'
import { Bell, Search, UserCircle2, X } from 'lucide-react'
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth'
import { AppSidebar } from './AppSidebar'
import { Separator } from '@/components/ui/separator'

export default function AppLayout() {
  const { user } = useAuth()
  const [searchValue, setSearchValue] = React.useState('')
  const [notificationsOpen, setNotificationsOpen] = React.useState(false)
  const [profileOpen, setProfileOpen] = React.useState(false)

  const fullName = user?.user_metadata?.full_name as string | undefined
  const email = user?.email ?? 'usuario@intelassist.local'

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="app-header sticky top-0 z-30 flex h-18 shrink-0 items-center gap-3 px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="h-5" />
          <div className="flex flex-1 items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="brand-monogram flex size-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold tracking-tight">
                IA
              </span>
              <div className="leading-tight">
                <p className="text-sm font-bold tracking-tight">
                  <span className="brand-text">INTELASIST</span>
                </p>
                <p className="text-[11px] font-medium text-muted-foreground">
                  Inteligencia Asistida · Informes
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 lg:gap-3">
              <div className="relative hidden min-w-[280px] md:block">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchValue}
                  onChange={(event) => setSearchValue(event.target.value)}
                  placeholder="Buscar informes"
                  className="pl-9 h-10 rounded-xl border-border/70 bg-background/80 text-sm shadow-sm"
                />
              </div>

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
                        <X className="size-3.5" />
                      </button>
                    </div>
                    <div className="mt-3 rounded-xl bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                      Sin notificaciones nuevas.
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="relative">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setProfileOpen(previous => !previous)}
                  className="rounded-xl border border-border/70 bg-background/70 text-muted-foreground shadow-sm transition-all hover:scale-[1.02] hover:bg-accent hover:text-foreground"
                  aria-label="Perfil"
                >
                  <UserCircle2 className="size-4" />
                </Button>

                {profileOpen ? (
                  <div className="absolute right-0 top-12 w-[260px] rounded-2xl border border-border/70 bg-background/95 p-3 shadow-[0_20px_54px_-28px_rgba(15,23,42,0.55)] backdrop-blur-sm">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold">Perfil</p>
                      <button
                        type="button"
                        onClick={() => setProfileOpen(false)}
                        className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                        aria-label="Cerrar perfil"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                    <div className="mt-3 space-y-1 rounded-xl bg-muted/50 px-3 py-2">
                      <p className="text-sm font-semibold">{fullName || 'Usuario'}</p>
                      <p className="text-xs text-muted-foreground">{email}</p>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </header>
        <main className="flex-1 min-w-0 overflow-auto">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
