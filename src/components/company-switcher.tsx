import { useNavigate } from "@tanstack/react-router";
import { Building2, Check, ChevronsUpDown, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useActiveCompany } from "@/hooks/use-companies";
import { cn } from "@/lib/utils";

export function CompanySwitcher() {
  const navigate = useNavigate();
  const { active, companies, setActiveId, isLoading } = useActiveCompany();

  if (isLoading) return <Skeleton className="h-9 w-56" />;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="w-56 justify-between" size="sm">
          <div className="flex items-center gap-2 truncate">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-primary/10 text-primary">
              <Building2 className="h-3.5 w-3.5" />
            </div>
            <div className="flex flex-col items-start leading-tight truncate">
              <span className="text-xs font-medium truncate max-w-[160px]">
                {active?.company.name ?? "Seleziona azienda"}
              </span>
              {active?.company.vat ? (
                <span className="text-[10px] text-muted-foreground">P.IVA {active.company.vat}</span>
              ) : null}
            </div>
          </div>
          <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Le tue aziende</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {companies.length === 0 ? (
          <div className="px-2 py-1.5 text-xs text-muted-foreground">Nessuna azienda</div>
        ) : (
          companies.map((m) => (
            <DropdownMenuItem
              key={m.company.id}
              onSelect={() => setActiveId(m.company.id)}
              className="gap-2"
            >
              <div className="flex h-6 w-6 items-center justify-center rounded bg-muted">
                <Building2 className="h-3 w-3" />
              </div>
              <div className="flex flex-col leading-tight flex-1 min-w-0">
                <span className="text-sm truncate">{m.company.name}</span>
                <span className="text-[10px] text-muted-foreground capitalize">{m.role}</span>
              </div>
              <Check
                className={cn(
                  "h-4 w-4",
                  active?.company.id === m.company.id ? "opacity-100" : "opacity-0",
                )}
              />
            </DropdownMenuItem>
          ))
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigate({ to: "/onboarding" })} className="gap-2">
          <Plus className="h-4 w-4" />
          Crea nuova azienda
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
