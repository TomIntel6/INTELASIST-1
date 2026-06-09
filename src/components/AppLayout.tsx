import { Outlet } from 'react-router-dom'
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar'
import { AppSidebar } from './AppSidebar'
import { Separator } from '@/components/ui/separator'

export default function AppLayout() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border/80 bg-card px-4 shadow-[0_16px_40px_-28px_rgba(15,23,42,0.28)]">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="h-4" />
          <div className="flex flex-1 items-center justify-between gap-3">
            <div className="relative flex flex-1 items-center overflow-hidden rounded-[1.5rem] border border-primary/20 bg-card px-4 py-2.5 shadow-[0_22px_60px_-30px_rgba(59,130,246,0.42),0_10px_28px_-18px_rgba(15,23,42,0.28)] backdrop-blur-sm before:absolute before:inset-0 before:rounded-[inherit] before:bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.18),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(59,130,246,0.16),_transparent_28%)] before:pointer-events-none dark:border-primary/35 dark:shadow-[0_24px_70px_-30px_rgba(96,165,250,0.45),0_12px_34px_-20px_rgba(15,23,42,0.36)]">
              <span className="relative z-10 text-sm font-semibold tracking-wide text-foreground">
                INTELASIST — Sistema Inteligente de Informes
              </span>
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
