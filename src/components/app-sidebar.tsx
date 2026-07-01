import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  TrendingUp,
  ReceiptText,
  FileBarChart2,
  Banknote,
  CalendarClock,
  FlaskConical,
  LineChart,
  Sparkles,
  FileSignature,
  Bot,
  HeartPulse,
  Settings,
  Wallet,
  FileUp,
  FileInput,
  FileStack,
  Contact,
  Landmark,
  Package,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const mainItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Cash Flow", url: "/cash-flow", icon: TrendingUp },
  { title: "Risorse Finanziarie", url: "/resources", icon: Landmark },
  { title: "Contabilità", url: "/accounting", icon: ReceiptText },
  { title: "Bilanci Storici", url: "/balance-sheets", icon: FileBarChart2 },
  { title: "Finanziamenti", url: "/financing", icon: Banknote },
  { title: "Fiscalità", url: "/tax-calendar", icon: CalendarClock },
  { title: "Simulazioni", url: "/simulations", icon: FlaskConical },
  { title: "Monitoraggio Costi", url: "/cost-monitor", icon: LineChart },
  { title: "Centro Opportunità", url: "/opportunities", icon: Sparkles },
  { title: "Contratti", url: "/contracts", icon: FileSignature },
  { title: "Consulente AI", url: "/ai-consultant", icon: Bot },
  { title: "Salute Aziendale", url: "/business-health", icon: HeartPulse },
] as const;

const documentItems = [
  { title: "Fatture Emesse", url: "/documents/sales", icon: FileUp },
  { title: "Fatture Ricevute", url: "/documents/purchases", icon: FileInput },
  { title: "Altri Documenti", url: "/documents/other", icon: FileStack },
  { title: "Clienti e Fornitori", url: "/counterparts", icon: Contact },
  { title: "Prodotti", url: "/products", icon: Package },
] as const;


const footerItems = [
  { title: "Impostazioni", url: "/settings", icon: Settings },
] as const;

export function AppSidebar({ basePath = "" }: { basePath?: string } = {}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const withBase = (p: string) => `${basePath}${p}`;
  const isActive = (path: string) => {
    const full = withBase(path);
    return pathname === full || pathname.startsWith(full + "/");
  };

  return (
    <Sidebar collapsible="icon" className="border-r">
      <SidebarHeader className="px-3 py-4">
        <Link to={withBase("/dashboard")} className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Wallet className="h-4 w-4" />
          </div>
          <div className="flex flex-col leading-tight group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-semibold tracking-tight">CFO AI</span>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Direttore Finanziario
            </span>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Operatività</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                    <Link to={withBase(item.url)}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Documenti</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {documentItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                    <Link to={withBase(item.url)}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>


      <SidebarFooter>
        <SidebarMenu>
          {footerItems.map((item) => (
            <SidebarMenuItem key={item.url}>
              <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                <Link to={withBase(item.url)}>
                  <item.icon className="h-4 w-4" />
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

