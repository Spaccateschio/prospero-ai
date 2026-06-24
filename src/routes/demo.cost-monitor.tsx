import { createFileRoute } from "@tanstack/react-router";

import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatEUR } from "@/lib/format";

export const Route = createFileRoute("/demo/cost-monitor")({
  component: DemoCostMonitor,
});

const monitored = [
  { name: "Energia elettrica", current: 540, market: 480, vendor: "Energia Italia" },
  { name: "Connettività fibra", current: 89, market: 65, vendor: "Telco Demo" },
  { name: "Carburante flotta", current: 1200, market: 1180, vendor: "Petrol Esempio" },
  { name: "Software gestionale", current: 199, market: 149, vendor: "SaaS Cloud" },
  { name: "Banca — canone conto", current: 18, market: 9, vendor: "Banca Demo" },
];

function DemoCostMonitor() {
  return (
    <div className="space-y-6 p-6">
      <header>
        <h1 className="text-xl font-semibold">Monitoraggio Costi</h1>
        <p className="text-sm text-muted-foreground">Confronto tariffe vs. mercato</p>
      </header>

      <div className="grid gap-3 lg:grid-cols-2">
        {monitored.map((m) => {
          const saving = m.current - m.market;
          const pct = Math.round((saving / m.current) * 100);
          return (
            <Card key={m.name}>
              <CardHeader>
                <CardTitle className="text-base">{m.name}</CardTitle>
                <CardDescription>Fornitore attuale: {m.vendor}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span>Spesa attuale</span>
                  <span className="font-semibold tabular-nums">{formatEUR(m.current)}/mese</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Migliore offerta mercato</span>
                  <span className="font-semibold tabular-nums text-emerald-600">{formatEUR(m.market)}/mese</span>
                </div>
                <Progress value={Math.max(0, 100 - pct * 2)} />
                <div className="text-xs text-muted-foreground">
                  Risparmio potenziale: <span className="font-medium text-emerald-600">{formatEUR(saving)}/mese</span> ({pct}%)
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
