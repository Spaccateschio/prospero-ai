import { createFileRoute } from "@tanstack/react-router";

import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { formatEUR } from "@/lib/format";
import { useDemoStore } from "@/lib/demo-store";

export const Route = createFileRoute("/demo/balance-sheets")({
  component: DemoBalance,
});

function DemoBalance() {
  const company = useDemoStore((s) => s.company);
  const invoices = useDemoStore((s) => s.invoices);

  const revenue = invoices.filter((i) => i.direction === "attiva").reduce((s, i) => s + i.amount, 0);
  const costs = invoices.filter((i) => i.direction === "passiva").reduce((s, i) => s + i.amount, 0);
  const margin = revenue - costs;

  // Mini-bilancio di esercizio basato sui dati demo
  const balance = [
    { label: "Ricavi delle vendite", value: revenue },
    { label: "Costi della produzione", value: -costs },
    { label: "Margine operativo lordo", value: margin, bold: true },
    { label: "Imposte stimate (IRES 24%)", value: -Math.max(0, margin) * 0.24 },
    { label: "Utile netto stimato", value: margin - Math.max(0, margin) * 0.24, bold: true },
  ];

  return (
    <div className="space-y-6 p-6">
      <header>
        <h1 className="text-xl font-semibold">Bilanci Storici</h1>
        <p className="text-sm text-muted-foreground">{company.name} — anno corrente</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Conto economico sintetico</CardTitle>
          <CardDescription>Calcolato dalle fatture demo registrate</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Voce</TableHead>
                <TableHead className="text-right">Valore</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {balance.map((b) => (
                <TableRow key={b.label}>
                  <TableCell className={b.bold ? "font-semibold" : ""}>{b.label}</TableCell>
                  <TableCell className={`text-right tabular-nums ${b.bold ? "font-semibold" : ""}`}>
                    {formatEUR(b.value)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
