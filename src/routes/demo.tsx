import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { AppSidebar } from "@/components/app-sidebar";
import { DemoModeBanner } from "@/components/demo/demo-mode-banner";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";

export const Route = createFileRoute("/demo")({
  ssr: false,
  beforeLoad: ({ location }) => {
    // /demo (senza figli) → reindirizza alla dashboard demo
    if (location.pathname === "/demo" || location.pathname === "/demo/") {
      throw redirect({ to: "/demo/dashboard" });
    }
  },
  component: DemoLayout,
});

function DemoLayout() {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar basePath="/demo" />
        <SidebarInset className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-12 items-center justify-between border-b px-3">
            <div className="flex items-center gap-2">
              <SidebarTrigger />
              <span className="text-sm font-medium text-muted-foreground">Demo · ACME Srl</span>
            </div>
            <ThemeToggle />
          </header>
          <DemoModeBanner />
          <main className="flex-1 overflow-x-hidden">
            <Outlet />
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
