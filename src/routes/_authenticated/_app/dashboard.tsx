import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Loader2, Building2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import { useActiveCompany } from "@/hooks/use-companies";
import { TransactionFormDialog } from "@/components/cashflow/transaction-form-dialog";
import { listCategories } from "@/lib/cashflow.functions";
import { WidgetGrid } from "@/components/dashboard/widget-grid";

export const Route = createFileRoute("/_authenticated/_app/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const { activeId, active, isLoading } = useActiveCompany();
  const [txOpen, setTxOpen] = useState(false);

  if (isLoading) {
    return <div className="flex items-center justify-center p-12 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /></div>;
  }
  if (!activeId || !active) {
    return (
      <div className="space-y-6 p-6">
        <header>
          <h1 className="text-xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Benvenuto in CFO AI</p>
        </header>
        <Alert>
          <Building2 className="h-4 w-4" />
          <AlertTitle>Configura la tua azienda per vedere i dati</AlertTitle>
          <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>
              Aggiungi la tua azienda (P.IVA o visura) per popolare la dashboard con flussi di cassa, scadenze e KPI reali.
            </span>
            <Button asChild size="sm">
              <Link to="/onboarding">Configura ora</Link>
            </Button>
          </AlertDescription>
        </Alert>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {["Cassa attuale", "Entrate (30g)", "Uscite (30g)", "Scadenze (7g)"].map((label) => (
            <Card key={label} className="opacity-60">
              <CardHeader>
                <CardDescription>{label}</CardDescription>
                <CardTitle className="text-2xl text-muted-foreground">—</CardTitle>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Panoramica finanziaria di {active.company.name}</p>
        </div>
        <Button onClick={() => setTxOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nuovo movimento
        </Button>
      </header>

      <WidgetGrid companyId={activeId} />

      <DashboardTxDialog open={txOpen} onOpenChange={setTxOpen} companyId={activeId} />
    </div>
  );
}

function DashboardTxDialog({ open, onOpenChange, companyId }: { open: boolean; onOpenChange: (v: boolean) => void; companyId: string }) {
  const fetchCategories = useServerFn(listCategories);
  const catsQuery = useQuery({
    queryKey: ["categories", companyId],
    queryFn: () => fetchCategories({ data: { company_id: companyId } }),
  });
  return (
    <TransactionFormDialog
      open={open}
      onOpenChange={onOpenChange}
      companyId={companyId}
      categories={(catsQuery.data ?? []).map((c) => ({ name: c.name as string, type: c.type as string }))}
    />
  );
}

