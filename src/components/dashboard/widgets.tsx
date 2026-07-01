import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { TrendingUp, Wallet, FileText, AlertCircle, Loader2 } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard } from "@/components/cashflow/kpi-card";
import { CashflowDualLineChart } from "@/components/cashflow/dual-line-chart";
import { formatEUR, formatDate, daysUntil } from "@/lib/format";
import { getDashboardKPIs, getTopExpenseCategories } from "@/lib/dashboard.functions";
import { getCashflowSummary } from "@/lib/cashflow.functions";

const DONUT_COLORS = ["#6366f1", "#f97316", "#10b981", "#eab308", "#ec4899", "#06b6d4"];

export type WidgetDef = {
  key: string;
  title: string;
  defaultSize: "sm" | "md" | "lg";
  render: (companyId: string) => React.ReactNode;
};

function RevenueWidget({ companyId }: { companyId: string }) {
  const fetchKpis = useServerFn(getDashboardKPIs);
  const q = useQuery({ queryKey: ["dashboard-kpis", companyId], queryFn: () => fetchKpis({ data: { company_id: companyId } }) });
  return (
    <KpiCard
      label="Fatturato mese"
      value={formatEUR(q.data?.revenue_month ?? 0)}
      deltaPct={q.data?.revenue_month_delta_pct ?? null}
      icon={TrendingUp}
      hint="vs mese precedente"
    />
  );
}

function CashflowMonthWidget({ companyId }: { companyId: string }) {
  const fetchKpis = useServerFn(getDashboardKPIs);
  const q = useQuery({ queryKey: ["dashboard-kpis", companyId], queryFn: () => fetchKpis({ data: { company_id: companyId } }) });
  return (
    <KpiCard
      label="Cash flow mese"
      value={formatEUR(q.data?.cashflow_month ?? 0)}
      deltaPct={q.data?.cashflow_month_delta_pct ?? null}
      icon={Wallet}
      hint="vs mese precedente"
    />
  );
}

function OpenInvoicesWidget({ companyId }: { companyId: string }) {
  const fetchKpis = useServerFn(getDashboardKPIs);
  const q = useQuery({ queryKey: ["dashboard-kpis", companyId], queryFn: () => fetchKpis({ data: { company_id: companyId } }) });
  return (
    <KpiCard
      label="Fatture aperte"
      value={formatEUR(q.data?.open_invoices_total ?? 0)}
      icon={FileText}
      hint={`${q.data?.open_invoices_count ?? 0} fatture`}
      invertColor
    />
  );
}

function UpcomingExpensesKpiWidget({ companyId }: { companyId: string }) {
  const fetchKpis = useServerFn(getDashboardKPIs);
  const q = useQuery({ queryKey: ["dashboard-kpis", companyId], queryFn: () => fetchKpis({ data: { company_id: companyId } }) });
  return (
    <KpiCard
      label="Uscite previste 30gg"
      value={formatEUR((q.data?.upcoming_expenses ?? []).reduce((s, e) => s + e.amount, 0))}
      icon={AlertCircle}
      hint={`${q.data?.upcoming_expenses.length ?? 0} movimenti`}
      invertColor
    />
  );
}

function CashflowChartWidget({ companyId }: { companyId: string }) {
  const fetchSummary = useServerFn(getCashflowSummary);
  const q = useQuery({
    queryKey: ["cashflow-summary", companyId, 6, 3],
    queryFn: () => fetchSummary({ data: { company_id: companyId, months_back: 6, months_forward: 3 } }),
  });
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Andamento Cash Flow</CardTitle>
        <CardDescription>Saldo netto mensile · consuntivo e stima</CardDescription>
      </CardHeader>
      <CardContent>
        {q.data ? (
          <CashflowDualLineChart data={q.data.months} todayMonth={q.data.today_month} />
        ) : (
          <div className="flex h-[220px] items-center justify-center text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /></div>
        )}
      </CardContent>
    </Card>
  );
}

function UpcomingDeadlinesWidget({ companyId }: { companyId: string }) {
  const fetchKpis = useServerFn(getDashboardKPIs);
  const q = useQuery({ queryKey: ["dashboard-kpis", companyId], queryFn: () => fetchKpis({ data: { company_id: companyId } }) });
  const expenses = q.data?.upcoming_expenses ?? [];
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Prossime scadenze</CardTitle>
        <CardDescription>Uscite previste nei prossimi 30 giorni</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {expenses.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Nessuna scadenza imminente</p>
        ) : (
          expenses.slice(0, 6).map((e) => {
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
  );
}

function TopExpenseCategoriesWidget({ companyId }: { companyId: string }) {
  const fetchTopCat = useServerFn(getTopExpenseCategories);
  const q = useQuery({ queryKey: ["top-expense-cat", companyId, 3], queryFn: () => fetchTopCat({ data: { company_id: companyId, months: 3 } }) });
  const data = q.data ?? [];
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Top categorie spesa</CardTitle>
        <CardDescription>Ultimi 3 mesi</CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">Nessuna spesa registrata</p>
        ) : (
          <div className="grid grid-cols-2 items-center gap-4">
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={data} dataKey="total" nameKey="category" innerRadius={45} outerRadius={72} paddingAngle={2}>
                  {data.map((_, i) => <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />)}
                </Pie>
                <Tooltip
                  contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number) => formatEUR(v)}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-1.5 text-xs">
              {data.map((c, i) => (
                <div key={c.category} className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
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
  );
}

function IncomeExpenseBarsWidget({ companyId }: { companyId: string }) {
  const fetchSummary = useServerFn(getCashflowSummary);
  const q = useQuery({
    queryKey: ["cashflow-summary", companyId, 6, 3],
    queryFn: () => fetchSummary({ data: { company_id: companyId, months_back: 6, months_forward: 3 } }),
  });
  const months = (q.data?.months ?? []).filter((m) => m.month <= (q.data?.today_month ?? "9999-12"));
  const max = Math.max(1, ...months.map((m) => Math.max(m.income_actual, m.expense_actual)));
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Entrate vs Uscite</CardTitle>
        <CardDescription>Ultimi 6 mesi</CardDescription>
      </CardHeader>
      <CardContent>
        {!q.data ? (
          <div className="flex h-[180px] items-center justify-center text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /></div>
        ) : (
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
        )}
      </CardContent>
    </Card>
  );
}

export const WIDGET_REGISTRY: WidgetDef[] = [
  { key: "revenue", title: "Fatturato mese", defaultSize: "sm", render: (id) => <RevenueWidget companyId={id} /> },
  { key: "cashflow_month", title: "Cash flow mese", defaultSize: "sm", render: (id) => <CashflowMonthWidget companyId={id} /> },
  { key: "open_invoices", title: "Fatture aperte", defaultSize: "sm", render: (id) => <OpenInvoicesWidget companyId={id} /> },
  { key: "upcoming_expenses_kpi", title: "Uscite previste 30gg", defaultSize: "sm", render: (id) => <UpcomingExpensesKpiWidget companyId={id} /> },
  { key: "cashflow_chart", title: "Andamento Cash Flow", defaultSize: "lg", render: (id) => <CashflowChartWidget companyId={id} /> },
  { key: "upcoming_deadlines", title: "Prossime scadenze", defaultSize: "md", render: (id) => <UpcomingDeadlinesWidget companyId={id} /> },
  { key: "top_expense_categories", title: "Top categorie spesa", defaultSize: "md", render: (id) => <TopExpenseCategoriesWidget companyId={id} /> },
  { key: "income_expense_bars", title: "Entrate vs Uscite", defaultSize: "md", render: (id) => <IncomeExpenseBarsWidget companyId={id} /> },
];

export function getWidgetDef(key: string): WidgetDef | undefined {
  return WIDGET_REGISTRY.find((w) => w.key === key);
}

export const DEFAULT_LAYOUT = WIDGET_REGISTRY.map((w) => ({
  id: w.key,
  kind: "widget" as const,
  widgetKey: w.key,
  size: w.defaultSize,
}));
