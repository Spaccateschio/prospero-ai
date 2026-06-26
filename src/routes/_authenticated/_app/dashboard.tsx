import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  TrendingUp, Wallet, FileText, AlertCircle, Plus, Sparkles, Loader2, Building2,
} from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";


import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import { useActiveCompany } from "@/hooks/use-companies";
import { formatEUR, formatDate, daysUntil } from "@/lib/format";
import { KpiCard } from "@/components/cashflow/kpi-card";
import { CashflowDualLineChart } from "@/components/cashflow/dual-line-chart";
import { TransactionFormDialog } from "@/components/cashflow/transaction-form-dialog";
import {
  getDashboardKPIs, getTopExpenseCategories,
} from "@/lib/dashboard.functions";
import { getCashflowSummary, listCategories } from "@/lib/cashflow.functions";

export const Route = createFileRoute("/_authenticated/_app/dashboard")({
  component: DashboardPage,
});

const DONUT_COLORS = ["#6366f1", "#f97316", "#10b981", "#eab308", "#ec4899", "#06b6d4"];

function DashboardPage() {
  const { activeId, active, isLoading } = useActiveCompany();
  const [txOpen, setTxOpen] = useState(false);

  if (isLoading) {
    return <div className="flex items-center justify-center p-12 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /></div>;
  }
  if (!activeId || !active) {
    return (
      <div className="p-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Nessuna azienda selezionata</AlertTitle>
          <AlertDescription>Crea o seleziona un'azienda per vedere la dashboard.</AlertDescription>
        </Alert>
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

      <DashboardContent companyId={activeId} onAddTx={() => setTxOpen(true)} />

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

function DashboardContent({ companyId, onAddTx }: { companyId: string; onAddTx: () => void }) {
  const fetchKpis = useServerFn(getDashboardKPIs);
  const fetchSummary = useServerFn(getCashflowSummary);
  const fetchTopCat = useServerFn(getTopExpenseCategories);

  const kpis = useQuery({
    queryKey: ["dashboard-kpis", companyId],
    queryFn: () => fetchKpis({ data: { company_id: companyId } }),
  });
  const summary = useQuery({
    queryKey: ["cashflow-summary", companyId, 6, 3],
    queryFn: () => fetchSummary({ data: { company_id: companyId, months_back: 6, months_forward: 3 } }),
  });
  const topCat = useQuery({
    queryKey: ["top-expense-cat", companyId, 3],
    queryFn: () => fetchTopCat({ data: { company_id: companyId, months: 3 } }),
  });

  const isEmpty =
    !kpis.isLoading &&
    kpis.data &&
    kpis.data.revenue_month === 0 &&
    kpis.data.cashflow_month === 0 &&
    kpis.data.open_invoices_count === 0 &&
    kpis.data.upcoming_expenses.length === 0;

  if (kpis.isLoading) {
    return <div className="flex items-center justify-center p-12 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /></div>;
  }

  return (
    <>
      {isEmpty && (
        <Card className="border-dashed">
          <CardContent className="flex items-center justify-between py-8">
            <div>
              <div className="flex items-center gap-2 text-base font-medium">
                <Sparkles className="h-4 w-4 text-primary" />
                Inizia a vedere i tuoi numeri
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Aggiungi il tuo primo movimento o carica dati demo dalle Impostazioni per esplorare la dashboard.
              </p>
            </div>
            <Button onClick={onAddTx}>
              <Plus className="mr-2 h-4 w-4" />
              Aggiungi movimento
            </Button>
          </CardContent>
        </Card>
      )}

      {/* KPI ROW */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Fatturato mese"
          value={formatEUR(kpis.data?.revenue_month ?? 0)}
          deltaPct={kpis.data?.revenue_month_delta_pct ?? null}
          icon={TrendingUp}
          hint="vs mese precedente"
        />
        <KpiCard
          label="Cash flow mese"
          value={formatEUR(kpis.data?.cashflow_month ?? 0)}
          deltaPct={kpis.data?.cashflow_month_delta_pct ?? null}
          icon={Wallet}
          hint="vs mese precedente"
        />
        <KpiCard
          label="Fatture aperte"
          value={formatEUR(kpis.data?.open_invoices_total ?? 0)}
          icon={FileText}
          hint={`${kpis.data?.open_invoices_count ?? 0} fatture`}
          invertColor
        />
        <KpiCard
          label="Uscite previste 30gg"
          value={formatEUR(
            (kpis.data?.upcoming_expenses ?? []).reduce((s, e) => s + e.amount, 0),
          )}
          icon={AlertCircle}
          hint={`${kpis.data?.upcoming_expenses.length ?? 0} movimenti`}
          invertColor
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Andamento Cash Flow</CardTitle>
            <CardDescription>
              Saldo netto mensile. <span className="font-medium">Linea solida</span> = consuntivo,{" "}
              <span className="font-medium">tratteggiata</span> = stima (include ricorrenze proiettate).
            </CardDescription>
          </CardHeader>
          <CardContent>
            {summary.data ? (
              <CashflowDualLineChart data={summary.data.months} todayMonth={summary.data.today_month} />
            ) : (
              <div className="flex h-[260px] items-center justify-center text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /></div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Prossime scadenze</CardTitle>
            <CardDescription>Uscite previste nei prossimi 30 giorni</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {(kpis.data?.upcoming_expenses ?? []).length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Nessuna scadenza imminente</p>
            ) : (
              kpis.data!.upcoming_expenses.map((e) => {
                const dd = daysUntil(e.date);
                return (
                  <div key={e.id} className="flex items-center justify-between rounded-md border p-2.5">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{e.description ?? "Movimento"}</div>
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

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top categorie spesa</CardTitle>
            <CardDescription>Ultimi 3 mesi</CardDescription>
          </CardHeader>
          <CardContent>
            {(topCat.data ?? []).length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">Nessuna spesa registrata</p>
            ) : (
              <div className="grid grid-cols-2 items-center gap-4">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={topCat.data ?? []}
                      dataKey="total"
                      nameKey="category"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                    >
                      {(topCat.data ?? []).map((_, i) => (
                        <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                      formatter={(v: number) => formatEUR(v)}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1.5 text-xs">
                  {(topCat.data ?? []).map((c, i) => (
                    <div key={c.category} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
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

        <Card>
          <CardHeader>
            <CardTitle>Entrate vs Uscite</CardTitle>
            <CardDescription>Ultimi 6 mesi</CardDescription>
          </CardHeader>
          <CardContent>
            {summary.data ? (
              <EntrateUsciteBars months={summary.data.months.filter((m) => m.month <= summary.data!.today_month)} />
            ) : (
              <div className="flex h-[200px] items-center justify-center text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /></div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function EntrateUsciteBars({ months }: { months: { month: string; income_actual: number; expense_actual: number }[] }) {
  const max = Math.max(1, ...months.map((m) => Math.max(m.income_actual, m.expense_actual)));
  return (
    <div className="space-y-2">
      {months.slice(-6).map((m) => (
        <div key={m.month} className="space-y-1">
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span>{m.month}</span>
            <span className="tabular-nums">
              <span className="text-emerald-500">+{formatEUR(m.income_actual)}</span>
              {" / "}
              <span className="text-rose-500">−{formatEUR(m.expense_actual)}</span>
            </span>
          </div>
          <div className="flex h-3 gap-0.5">
            <div className="h-full rounded-sm bg-emerald-500/70" style={{ width: `${(m.income_actual / max) * 50}%` }} />
            <div className="h-full rounded-sm bg-rose-500/70" style={{ width: `${(m.expense_actual / max) * 50}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
