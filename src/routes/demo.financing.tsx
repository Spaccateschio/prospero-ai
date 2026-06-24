import { createFileRoute } from "@tanstack/react-router";

import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatEUR } from "@/lib/format";

export const Route = createFileRoute("/demo/financing")({
  component: DemoFinancing,
});

const loans = [
  { name: "Mutuo chirografario — Banca Demo", amount: 80000, residual: 42000, rate: 4.2, monthly: 1450, end: "2029-03" },
  { name: "Fido di cassa — Banca Esempio", amount: 30000, residual: 18500, rate: 7.8, monthly: 0, end: "Revolving" },
  { name: "Leasing furgone — Leasing Italia", amount: 25000, residual: 11200, rate: 5.1, monthly: 480, end: "2028-09" },
];

function DemoFinancing() {
  const total = loans.reduce((s, l) => s + l.residual, 0);
  const monthly = loans.reduce((s, l) => s + l.monthly, 0);

  return (
    <div className="space-y-6 p-6">
      <header>
        <h1 className="text-xl font-semibold">Finanziamenti</h1>
        <p className="text-sm text-muted-foreground">Esposizione bancaria e rateazioni in corso</p>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card><CardContent className="p-4"><div className="text-xs uppercase text-muted-foreground">Debito residuo</div><div className="mt-1 text-xl font-semibold">{formatEUR(total)}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs uppercase text-muted-foreground">Rata media mensile</div><div className="mt-1 text-xl font-semibold">{formatEUR(monthly)}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs uppercase text-muted-foreground">Linee attive</div><div className="mt-1 text-xl font-semibold">{loans.length}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Linee di credito</CardTitle>
          <CardDescription>Dati demo</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Linea</TableHead>
                <TableHead className="text-right">Originario</TableHead>
                <TableHead className="text-right">Residuo</TableHead>
                <TableHead className="text-right">TAN</TableHead>
                <TableHead className="text-right">Rata</TableHead>
                <TableHead>Scadenza</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loans.map((l) => (
                <TableRow key={l.name}>
                  <TableCell>{l.name}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatEUR(l.amount)}</TableCell>
                  <TableCell className="text-right tabular-nums font-medium">{formatEUR(l.residual)}</TableCell>
                  <TableCell className="text-right tabular-nums">{l.rate}%</TableCell>
                  <TableCell className="text-right tabular-nums">{l.monthly ? formatEUR(l.monthly) : "—"}</TableCell>
                  <TableCell><Badge variant="secondary">{l.end}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
