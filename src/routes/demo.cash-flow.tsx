import { createFileRoute } from "@tanstack/react-router";
import { Plus, TrendingUp, Wallet } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { KpiCard } from "@/components/cashflow/kpi-card";
import { CashflowDualLineChart } from "@/components/cashflow/dual-line-chart";

import { formatDate, formatEUR } from "@/lib/format";
import { useDemoStore } from "@/lib/demo-store";
import { useDemoCashflowSeries, useDemoKPIs } from "@/lib/demo-selectors";

import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/demo/cash-flow")({
  component: DemoCashFlow,
});

function DemoCashFlow() {
  const payments = useDemoStore((s) => s.payments);
  const series = useDemoCashflowSeries(6, 3);
  const kpis = useDemoKPIs();
  const [open, setOpen] = useState(false);

  const inFlow = payments.filter((p) => p.direction === "in").reduce((s, p) => s + p.amount, 0);
  const outFlow = payments.filter((p) => p.direction === "out").reduce((s, p) => s + p.amount, 0);

  return (
    <div className="space-y-6 p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Cash Flow</h1>
          <p className="text-sm text-muted-foreground">Entrate e uscite, consuntivo e previsionale</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nuovo pagamento
        </Button>
      </header>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Entrate registrate" value={formatEUR(inFlow)} icon={TrendingUp} hint={`${payments.filter((p) => p.direction === "in").length} pagamenti`} />
        <KpiCard label="Uscite pianificate" value={formatEUR(outFlow)} icon={Wallet} hint={`${payments.filter((p) => p.direction === "out").length} pagamenti`} invertColor />
        <KpiCard label="Cash flow mese" value={formatEUR(kpis.cashflow_month)} deltaPct={kpis.cashflow_month_delta_pct} icon={TrendingUp} hint="vs mese precedente" />
        <KpiCard label="Saldo netto" value={formatEUR(inFlow - outFlow)} icon={Wallet} hint="entrate − uscite" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Andamento</CardTitle>
          <CardDescription>Ultimi 6 mesi + 3 di stima</CardDescription>
        </CardHeader>
        <CardContent>
          <CashflowDualLineChart data={series.months} todayMonth={series.today_month} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pagamenti</CardTitle>
          <CardDescription>Storico ricevuti e pianificati in uscita</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Controparte</TableHead>
                <TableHead>Metodo</TableHead>
                <TableHead>Direzione</TableHead>
                <TableHead className="text-right">Importo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...payments].sort((a, b) => b.date.localeCompare(a.date)).map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{formatDate(p.date)}</TableCell>
                  <TableCell>{p.counterpart_name}</TableCell>
                  <TableCell className="capitalize">{p.method}</TableCell>
                  <TableCell>
                    {p.direction === "in"
                      ? <Badge variant="secondary" className="bg-emerald-500/15 text-emerald-600">Entrata</Badge>
                      : <Badge variant="secondary" className="bg-rose-500/15 text-rose-600">Uscita</Badge>}
                  </TableCell>
                  <TableCell className={`text-right tabular-nums font-medium ${p.direction === "in" ? "text-emerald-600" : "text-rose-600"}`}>
                    {p.direction === "in" ? "+" : "−"}{formatEUR(p.amount)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <NewPaymentDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}

function NewPaymentDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const addPayment = useDemoStore((s) => s.addPayment);
  const [direction, setDirection] = useState<"in" | "out">("in");
  const [counterpart, setCounterpart] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState<"bonifico" | "carta" | "contanti" | "rid">("bonifico");

  function submit() {
    const a = parseFloat(amount);
    if (!a || a <= 0 || !counterpart) return;
    addPayment({ direction, counterpart_name: counterpart, amount: a, date, method });
    setCounterpart(""); setAmount("");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Nuovo pagamento (demo)</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Direzione</Label>
              <Select value={direction} onValueChange={(v) => setDirection(v as "in" | "out")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="in">Entrata</SelectItem>
                  <SelectItem value="out">Uscita</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Data</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Controparte</Label>
            <Input value={counterpart} onChange={(e) => setCounterpart(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Importo (€)</Label>
              <Input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div>
              <Label>Metodo</Label>
              <Select value={method} onValueChange={(v) => setMethod(v as typeof method)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bonifico">Bonifico</SelectItem>
                  <SelectItem value="carta">Carta</SelectItem>
                  <SelectItem value="contanti">Contanti</SelectItem>
                  <SelectItem value="rid">RID</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annulla</Button>
          <Button onClick={submit}>Salva (solo demo)</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
