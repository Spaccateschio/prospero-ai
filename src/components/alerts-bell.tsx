import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { Bell, AlertTriangle, AlertCircle, Info, Wallet, FileText, CalendarClock, Banknote, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

import { useActiveCompanyId } from "@/hooks/use-companies";
import { listAlerts } from "@/lib/alerts.functions";
import type { AlertItem, AlertKind, AlertSeverity } from "@/lib/alerts.functions";

const KIND_LABEL: Record<AlertKind, string> = {
  cash_below_threshold: "Cassa sotto soglia",
  invoice_overdue: "Fatture scadute",
  deadline_soon: "Scadenze imminenti",
  loan_due_soon: "Rate in arrivo",
};

function kindIcon(k: AlertKind) {
  switch (k) {
    case "cash_below_threshold": return Wallet;
    case "invoice_overdue": return FileText;
    case "deadline_soon": return CalendarClock;
    case "loan_due_soon": return Banknote;
  }
}

function severityIcon(s: AlertSeverity) {
  switch (s) {
    case "danger": return AlertCircle;
    case "warning": return AlertTriangle;
    case "info": return Info;
  }
}

function severityClass(s: AlertSeverity): string {
  switch (s) {
    case "danger": return "text-destructive";
    case "warning": return "text-amber-600 dark:text-amber-400";
    case "info": return "text-muted-foreground";
  }
}

export function AlertsBell() {
  const navigate = useNavigate();
  const { activeId } = useActiveCompanyId();
  const fetchAlerts = useServerFn(listAlerts);

  const { data, isLoading } = useQuery({
    queryKey: ["alerts", activeId],
    queryFn: async () => {
      if (!activeId) return { alerts: [] as AlertItem[], count: 0, by_kind: {} as Record<AlertKind, number> };
      return await fetchAlerts({ data: { company_id: activeId } });
    },
    enabled: !!activeId,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const count = data?.count ?? 0;
  const alerts = data?.alerts ?? [];

  // Raggruppa per kind preservando l'ordine (danger first)
  const groups = new Map<AlertKind, AlertItem[]>();
  for (const a of alerts) {
    const list = groups.get(a.kind) ?? [];
    list.push(a);
    groups.set(a.kind, list);
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Notifiche" title="Notifiche" className="relative">
          <Bell className="h-4 w-4" />
          {count > 0 && (
            <Badge
              variant="destructive"
              className="absolute -right-0.5 -top-0.5 h-4 min-w-[16px] rounded-full px-1 text-[10px] leading-none"
            >
              {count > 99 ? "99+" : count}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[360px] p-0">
        <div className="flex items-center justify-between p-3">
          <div>
            <div className="text-sm font-semibold">Avvisi</div>
            <div className="text-xs text-muted-foreground">
              {isLoading ? "Caricamento…" : count === 0 ? "Tutto in ordine" : `${count} avvisi attivi`}
            </div>
          </div>
          {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
        <Separator />
        <ScrollArea className="max-h-[420px]">
          {count === 0 && !isLoading ? (
            <div className="flex flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted-foreground">
              <Bell className="h-5 w-5 opacity-50" />
              <p>Nessun avviso al momento.</p>
            </div>
          ) : (
            <div className="py-1">
              {Array.from(groups.entries()).map(([kind, list]) => {
                const KIcon = kindIcon(kind);
                return (
                  <div key={kind} className="px-1 py-1">
                    <div className="flex items-center gap-2 px-2 py-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                      <KIcon className="h-3 w-3" />
                      {KIND_LABEL[kind]}
                      <span className="ml-auto">{list.length}</span>
                    </div>
                    {list.map((a) => {
                      const SIcon = severityIcon(a.severity);
                      return (
                        <button
                          key={a.id}
                          onClick={() => navigate({ to: a.href })}
                          className="flex w-full items-start gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-muted"
                        >
                          <SIcon className={`mt-0.5 h-4 w-4 shrink-0 ${severityClass(a.severity)}`} />
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-medium">{a.title}</div>
                            <div className="text-xs text-muted-foreground line-clamp-2">{a.description}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
