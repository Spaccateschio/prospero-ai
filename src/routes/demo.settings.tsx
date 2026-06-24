import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";

import { useDemoStore } from "@/lib/demo-store";

export const Route = createFileRoute("/demo/settings")({
  component: DemoSettings,
});

function DemoSettings() {
  const company = useDemoStore((s) => s.company);
  const reset = useDemoStore((s) => s.reset);
  const counts = useDemoStore((s) => ({
    inv: s.invoices.length, pay: s.payments.length,
    cl: s.clients.length, sup: s.suppliers.length, tx: s.transactions.length,
  }));

  return (
    <div className="space-y-6 p-6">
      <header>
        <h1 className="text-xl font-semibold">Impostazioni</h1>
        <p className="text-sm text-muted-foreground">Modalità demo — dati nel tuo browser</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Azienda demo</CardTitle>
          <CardDescription>Anagrafica pre-popolata</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
          <div><span className="text-muted-foreground">Nome:</span> {company.name}</div>
          <div><span className="text-muted-foreground">P.IVA:</span> {company.vat}</div>
          <div><span className="text-muted-foreground">Sede:</span> {company.city} ({company.province})</div>
          <div><span className="text-muted-foreground">Forma:</span> {company.company_type.toUpperCase()}</div>
          <div><span className="text-muted-foreground">ATECO:</span> {company.ateco}</div>
          <div><span className="text-muted-foreground">Dipendenti:</span> {company.employees_count}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Dati nel tuo browser</CardTitle>
          <CardDescription>
            Tutto è memorizzato in <code className="text-xs">localStorage</code> con la chiave
            <code className="ml-1 text-xs">cfo-demo-v1</code>. Sopravvive ai refresh ma non viene
            sincronizzato altrove.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Stat label="Fatture" value={counts.inv} />
          <Stat label="Pagamenti" value={counts.pay} />
          <Stat label="Clienti" value={counts.cl} />
          <Stat label="Fornitori" value={counts.sup} />
          <Stat label="Movimenti" value={counts.tx} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Reimposta dati demo</CardTitle>
          <CardDescription>
            Cancella tutte le modifiche fatte nella demo e riparte dal seed iniziale.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="destructive"
            onClick={() => {
              reset();
              toast.success("Dati demo reimpostati");
            }}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Reimposta ora
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}
