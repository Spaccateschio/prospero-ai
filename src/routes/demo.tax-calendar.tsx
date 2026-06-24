import { createFileRoute } from "@tanstack/react-router";
import { CalendarClock } from "lucide-react";

import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatEUR } from "@/lib/format";

export const Route = createFileRoute("/demo/tax-calendar")({
  component: DemoTax,
});

const today = new Date();
const inDays = (n: number) => {
  const d = new Date(today); d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

const deadlines = [
  { date: inDays(3), title: "Liquidazione IVA trimestrale", amount: 4200, kind: "IVA" },
  { date: inDays(10), title: "F24 ritenute lavoro dipendente", amount: 3850, kind: "F24" },
  { date: inDays(18), title: "Contributi INPS dipendenti", amount: 5100, kind: "INPS" },
  { date: inDays(25), title: "Acconto IRES", amount: 2400, kind: "IRES" },
  { date: inDays(42), title: "Saldo IRAP", amount: 1280, kind: "IRAP" },
];

function DemoTax() {
  const total = deadlines.reduce((s, d) => s + d.amount, 0);
  return (
    <div className="space-y-6 p-6">
      <header>
        <h1 className="text-xl font-semibold">Fiscalità</h1>
        <p className="text-sm text-muted-foreground">Scadenze fiscali e contributive previste</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><CalendarClock className="h-4 w-4" /> Prossimi adempimenti</CardTitle>
          <CardDescription>Totale stimato: <span className="font-medium">{formatEUR(total)}</span></CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {deadlines.map((d) => (
            <div key={d.title} className="flex items-center justify-between rounded-md border p-3">
              <div>
                <div className="font-medium">{d.title}</div>
                <div className="text-xs text-muted-foreground">{formatDate(d.date)}</div>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="secondary">{d.kind}</Badge>
                <span className="font-semibold tabular-nums">{formatEUR(d.amount)}</span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
