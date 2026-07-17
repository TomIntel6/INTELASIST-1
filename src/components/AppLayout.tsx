import { Outlet } from 'react-router-dom'
import { Bell, Search, UserCircle2 } from 'lucide-react'
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { AppSidebar } from './AppSidebar'
import { Separator } from '@/components/ui/separator'

export default function AppLayout() {
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
                  value=""
                  readOnly
                  placeholder="Buscar informes"
                  className="pl-9 h-10 rounded-xl border-border/70 bg-background/80 text-sm shadow-sm"
                />
              </div>

              <Button
                variant="ghost"
                size="icon-sm"
                className="rounded-xl border border-border/70 bg-background/70 text-muted-foreground shadow-sm transition-all hover:scale-[1.02] hover:bg-accent hover:text-foreground"
                aria-label="Notificaciones"
              >
                <Bell className="size-4" />
              </Button>

              <Button
                variant="ghost"
                size="icon-sm"
                className="rounded-xl border border-border/70 bg-background/70 text-muted-foreground shadow-sm transition-all hover:scale-[1.02] hover:bg-accent hover:text-foreground"
                aria-label="Perfil"
              >
                <UserCircle2 className="size-4" />
              </Button>
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
