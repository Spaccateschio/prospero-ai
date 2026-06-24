import { createFileRoute } from "@tanstack/react-router";
import { HeartPulse } from "lucide-react";

import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useDemoKPIs } from "@/lib/demo-selectors";

export const Route = createFileRoute("/demo/business-health")({
  component: DemoHealth,
});

function DemoHealth() {
  const kpis = useDemoKPIs();
  const liquidity = Math.min(100, Math.max(0, 50 + (kpis.cashflow_month / 1000)));
  const collection = kpis.open_invoices_total === 0 ? 100 : Math.max(0, 100 - (kpis.overdue_total / kpis.open_invoices_total) * 100);
  const growth = Math.min(100, Math.max(0, 50 + (kpis.revenue_month_delta_pct ?? 0)));
  const score = Math.round((liquidity + collection + growth) / 3);

  const status = score >= 70 ? { label: "Solida", color: "text-emerald-600" }
    : score >= 50 ? { label: "Da monitorare", color: "text-amber-600" }
    : { label: "Critica", color: "text-rose-600" };

  return (
    <div className="space-y-6 p-6">
      <header className="flex items-center gap-2">
        <HeartPulse className="h-5 w-5 text-primary" />
        <div>
          <h1 className="text-xl font-semibold">Salute Aziendale</h1>
          <p className="text-sm text-muted-foreground">Indice sintetico basato sui tuoi numeri</p>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Indice complessivo</CardTitle>
          <CardDescription>Aggiornato in tempo reale dai dati demo</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-end gap-4">
            <div className="text-6xl font-semibold tabular-nums">{score}</div>
            <div className={`text-lg font-medium ${status.color}`}>{status.label}</div>
          </div>
          <Progress value={score} />
        </CardContent>
      </Card>

      <div className="grid gap-3 lg:grid-cols-3">
        <Metric label="Liquidità" value={Math.round(liquidity)} desc="Cash flow vs neutralità" />
        <Metric label="Incassi" value={Math.round(collection)} desc="% non scaduto sulle aperte" />
        <Metric label="Crescita" value={Math.round(growth)} desc="Fatturato vs mese precedente" />
      </div>
    </div>
  );
}

function Metric({ label, value, desc }: { label: string; value: number; desc: string }) {
  return (
    <Card>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-medium">{label}</span>
          <span className="text-2xl font-semibold tabular-nums">{value}</span>
        </div>
        <Progress value={value} />
        <p className="text-xs text-muted-foreground">{desc}</p>
      </CardContent>
    </Card>
  );
}
