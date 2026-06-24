import { createFileRoute } from "@tanstack/react-router";
import {
  AlertCircle, FileText, Plus, TrendingUp, Wallet,
} from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { KpiCard } from "@/components/cashflow/kpi-card";
import { CashflowDualLineChart } from "@/components/cashflow/dual-line-chart";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

import { formatDate, formatEUR, daysUntil } from "@/lib/format";
import { useDemoStore } from "@/lib/demo-store";
import {
  useDemoCashflowSeries, useDemoKPIs, useDemoTopExpenseCategories,
} from "@/lib/demo-selectors";

export const Route = createFileRoute("/demo/dashboard")({
  component: DemoDashboard,
});

const DONUT = ["#6366f1", "#f97316", "#10b981", "#eab308", "#ec4899", "#06b6d4"];

function DemoDashboard() {
  const company = useDemoStore((s) => s.company);
  const kpis = useDemoKPIs();
  const summary = useDemoCashflowSeries(6, 3);
  const topCat = useDemoTopExpenseCategories(3);
  const [txOpen, setTxOpen] = useState(false);

  return (
    <div className="space-y-6 p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Panoramica finanziaria di {company.name}
          </p>
        </div>
        <Button onClick={() => setTxOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nuovo movimento
        </Button>
      </header>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Fatturato mese" value={formatEUR(kpis.revenue_month)} deltaPct={kpis.revenue_month_delta_pct} icon={TrendingUp} hint="vs mese precedente" />
        <KpiCard label="Cash flow mese" value={formatEUR(kpis.cashflow_month)} deltaPct={kpis.cashflow_month_delta_pct} icon={Wallet} hint="vs mese precedente" />
        <KpiCard label="Fatture aperte" value={formatEUR(kpis.open_invoices_total)} icon={FileText} hint={`${kpis.open_invoices_count} fatture`} invertColor />
        <KpiCard label="Uscite previste 30gg" value={formatEUR(kpis.upcoming_expenses.reduce((s, e) => s + e.amount, 0))} icon={AlertCircle} hint={`${kpis.upcoming_expenses.length} movimenti`} invertColor />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Andamento Cash Flow</CardTitle>
            <CardDescription>
              Saldo netto mensile. <span className="font-medium">Linea solida</span> = consuntivo,{" "}
              <span className="font-medium">tratteggiata</span> = stima.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CashflowDualLineChart data={summary.months} todayMonth={summary.today_month} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Prossime scadenze</CardTitle>
            <CardDescription>Uscite previste nei prossimi 30 giorni</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {kpis.upcoming_expenses.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Nessuna scadenza imminente</p>
            ) : (
              kpis.upcoming_expenses.map((e) => {
                const dd = daysUntil(e.date);
                return (
                  <div key={e.id} className="flex items-center justify-between rounded-md border p-2.5">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{e.description}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatDate(e.date)}
                        {dd !== null && dd >= 0 && ` · tra ${dd} ${dd === 1 ? "giorno" : "giorni"}`}
                      </div>
                    </div>
                    <div className="text-sm font-semibold text-rose-500 tabular-nums">−{formatEUR(e.amount).replace("−", "")}</div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Top categorie spesa</CardTitle>
          <CardDescription>Ultimi 3 mesi</CardDescription>
        </CardHeader>
        <CardContent>
          {topCat.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">Nessuna spesa registrata</p>
          ) : (
            <div className="grid grid-cols-2 items-center gap-4">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={topCat} dataKey="total" nameKey="category" innerRadius={55} outerRadius={90} paddingAngle={2}>
                    {topCat.map((_, i) => (
                      <Cell key={i} fill={DONUT[i % DONUT.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} formatter={(v: number) => formatEUR(v)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 text-xs">
                {topCat.map((c, i) => (
                  <div key={c.category} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: DONUT[i % DONUT.length] }} />
                      <span className="truncate">{c.category}</span>
                    </div>
                    <span className="font-medium tabular-nums">{formatEUR(c.total)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <DemoTxDialog open={txOpen} onOpenChange={setTxOpen} />
    </div>
  );
}

function DemoTxDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const addTx = useDemoStore((s) => s.addTransaction);
  const categories = useDemoStore((s) => s.categories);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [type, setType] = useState<"income" | "expense">("income");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Vendite");

  function submit() {
    const v = parseFloat(amount);
    if (!v || v <= 0) return;
    addTx({ date, type, amount: v, description: description || "Movimento", category });
    setAmount(""); setDescription("");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuovo movimento (demo)</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Tipo</Label>
              <Select value={type} onValueChange={(v) => setType(v as "income" | "expense")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">Entrata</SelectItem>
                  <SelectItem value="expense">Uscita</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Data</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Importo (€)</Label>
            <Input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div>
            <Label>Descrizione</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="es. Vendita servizi" />
          </div>
          <div>
            <Label>Categoria</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {categories.filter((c) => c.type === type).map((c) => (
                  <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
