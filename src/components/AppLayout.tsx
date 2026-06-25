import { Outlet } from 'react-router-dom'
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar'
import { AppSidebar } from './AppSidebar'
import { Separator } from '@/components/ui/separator'

export default function AppLayout() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="app-header flex h-16 shrink-0 items-center gap-3 px-4">
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
            <span className="hidden items-center gap-1.5 rounded-full border border-border/70 bg-card/60 px-2.5 py-1 text-[11px] font-medium text-muted-foreground backdrop-blur-sm sm:flex">
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500/70" />
                <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
              </span>
              Sistema activo
            </span>
          </div>
        </header>
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
