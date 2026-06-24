import { createFileRoute } from "@tanstack/react-router";
import { FileSignature } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { formatDate, formatEUR } from "@/lib/format";

export const Route = createFileRoute("/demo/contracts")({
  component: DemoContracts,
});

const today = new Date();
const inDays = (n: number) => { const d = new Date(today); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

const contracts = [
  { name: "Hosting Pro Srl — Cloud business", value: 14400, renewal: inDays(45), kind: "Annuale", autorenew: true },
  { name: "Studio Commercialista Rossi", value: 9600, renewal: inDays(120), kind: "Annuale", autorenew: true },
  { name: "Energia Italia Spa — utenza sede", value: 6500, renewal: inDays(10), kind: "Mercato libero", autorenew: false },
  { name: "Beta Spa — fornitura servizi", value: 36000, renewal: inDays(200), kind: "Cliente", autorenew: false },
];

function DemoContracts() {
  return (
    <div className="space-y-6 p-6">
      <header className="flex items-center gap-2">
        <FileSignature className="h-5 w-5 text-primary" />
        <div>
          <h1 className="text-xl font-semibold">Contratti</h1>
          <p className="text-sm text-muted-foreground">Scadenze e rinnovi automatici</p>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Contratti in essere</CardTitle>
          <CardDescription>{contracts.length} contratti attivi</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contratto</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Rinnovo</TableHead>
                <TableHead>Auto-rinnovo</TableHead>
                <TableHead className="text-right">Valore annuo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contracts.map((c) => (
                <TableRow key={c.name}>
                  <TableCell>{c.name}</TableCell>
                  <TableCell>{c.kind}</TableCell>
                  <TableCell>{formatDate(c.renewal)}</TableCell>
                  <TableCell>
                    {c.autorenew
                      ? <Badge variant="secondary" className="bg-amber-500/15 text-amber-700">Sì</Badge>
                      : <Badge variant="outline">No</Badge>}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatEUR(c.value)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
