import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { AppSidebar } from "@/components/app-sidebar";
import { TopBar } from "@/components/top-bar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { useActiveCompany } from "@/hooks/use-companies";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Layout pathless con shell (sidebar + topbar).
 * Pagine come /onboarding restano fuori da questo layout (full screen).
 */
export const Route = createFileRoute("/_authenticated/_app")({
  component: AppLayout,
});

function AppLayout() {
  const navigate = useNavigate();
  const { companies, isLoading } = useActiveCompany();

  useEffect(() => {
    if (!isLoading && companies.length === 0) {
      navigate({ to: "/onboarding", replace: true });
    }
  }, [isLoading, companies.length, navigate]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3 w-32" />
        </div>
      </div>
    );
  }

  if (companies.length === 0) return null;

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <SidebarInset className="flex min-w-0 flex-1 flex-col">
          <TopBar />
          <main className="flex-1 overflow-x-hidden">
            <Outlet />
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
