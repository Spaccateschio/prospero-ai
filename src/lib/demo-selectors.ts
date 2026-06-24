import { useDemoStore } from "./demo-store";

const ym = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

export type DemoKPIs = {
  revenue_month: number;
  revenue_month_delta_pct: number | null;
  cashflow_month: number;
  cashflow_month_delta_pct: number | null;
  open_invoices_total: number;
  open_invoices_count: number;
  overdue_total: number;
  overdue_count: number;
  upcoming_expenses: { id: string; date: string; description: string; amount: number }[];
};

export function useDemoKPIs(): DemoKPIs {
  const { invoices, transactions, payments } = useDemoStore();
  const now = new Date();
  const thisMonth = ym(now);
  const prevMonthDate = new Date(now);
  prevMonthDate.setMonth(prevMonthDate.getMonth() - 1);
  const prevMonth = ym(prevMonthDate);

  const revInMonth = (m: string) =>
    invoices
      .filter((i) => i.direction === "attiva" && ym(new Date(i.issue_date)) === m)
      .reduce((s, i) => s + i.amount, 0);

  const cashflowInMonth = (m: string) =>
    transactions
      .filter((t) => ym(new Date(t.date)) === m)
      .reduce((s, t) => s + (t.type === "income" ? t.amount : -t.amount), 0);

  const revenue_month = revInMonth(thisMonth);
  const revenue_prev = revInMonth(prevMonth);
  const cashflow_month = cashflowInMonth(thisMonth);
  const cashflow_prev = cashflowInMonth(prevMonth);

  const open = invoices.filter((i) => i.status !== "paid" && i.status !== "draft");
  const open_invoices_total = open.reduce((s, i) => s + i.total_amount, 0);
  const overdue = invoices.filter((i) => i.status === "overdue");

  const today = new Date();
  const in30 = new Date();
  in30.setDate(in30.getDate() + 30);
  const upcoming_expenses = payments
    .filter((p) => p.direction === "out")
    .filter((p) => {
      const d = new Date(p.date);
      return d >= today && d <= in30;
    })
    .map((p) => ({ id: p.id, date: p.date, description: p.counterpart_name, amount: p.amount }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const pctDelta = (curr: number, prev: number) =>
    prev === 0 ? null : ((curr - prev) / Math.abs(prev)) * 100;

  return {
    revenue_month,
    revenue_month_delta_pct: pctDelta(revenue_month, revenue_prev),
    cashflow_month,
    cashflow_month_delta_pct: pctDelta(cashflow_month, cashflow_prev),
    open_invoices_total,
    open_invoices_count: open.length,
    overdue_total: overdue.reduce((s, i) => s + i.total_amount, 0),
    overdue_count: overdue.length,
    upcoming_expenses,
  };
}

export type DemoMonthPoint = {
  month: string;
  income_actual: number;
  expense_actual: number;
  income_forecast: number;
  expense_forecast: number;
};

export function useDemoCashflowSeries(monthsBack = 6, monthsForward = 3) {
  const { transactions, payments } = useDemoStore();
  const now = new Date();
  const today_month = ym(now);
  const months: DemoMonthPoint[] = [];

  for (let i = -monthsBack; i <= monthsForward; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const m = ym(d);
    const isPast = i < 0 || (i === 0);
    const txInM = transactions.filter((t) => ym(new Date(t.date)) === m);
    const income_actual = isPast
      ? txInM.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0)
      : 0;
    const expense_actual = isPast
      ? txInM.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0)
      : 0;
    // Forecast: pagamenti pianificati nel mese
    const payInM = payments.filter((p) => ym(new Date(p.date)) === m);
    const income_forecast = i >= 0
      ? payInM.filter((p) => p.direction === "in").reduce((s, p) => s + p.amount, 0)
      : 0;
    const expense_forecast = i >= 0
      ? payInM.filter((p) => p.direction === "out").reduce((s, p) => s + p.amount, 0)
      : 0;
    months.push({ month: m, income_actual, expense_actual, income_forecast, expense_forecast });
  }

  return { months, today_month };
}

export function useDemoTopExpenseCategories(months = 3) {
  const { transactions } = useDemoStore();
  const now = new Date();
  const cutoff = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);

  const map = new Map<string, number>();
  for (const t of transactions) {
    if (t.type !== "expense") continue;
    if (new Date(t.date) < cutoff) continue;
    map.set(t.category, (map.get(t.category) ?? 0) + t.amount);
  }
  return [...map.entries()]
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 6);
}
