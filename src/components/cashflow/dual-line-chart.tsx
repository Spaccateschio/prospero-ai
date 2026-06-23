import { useMemo } from "react";
import {
  CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend, ReferenceLine,
} from "recharts";
import { format, parse } from "date-fns";
import { it } from "date-fns/locale";

import { formatEUR, formatEURCompact } from "@/lib/format";

export type CashflowSeriesPoint = {
  month: string; // yyyy-MM
  income_actual: number;
  expense_actual: number;
  income_forecast: number;
  expense_forecast: number;
};

export function CashflowDualLineChart({
  data,
  todayMonth,
}: {
  data: CashflowSeriesPoint[];
  todayMonth: string;
}) {
  const series = useMemo(() => {
    return data.map((d) => {
      const isFuture = d.month > todayMonth;
      const isCurrent = d.month === todayMonth;
      const actualNet = d.income_actual - d.expense_actual;
      const forecastNet =
        (d.income_actual + d.income_forecast) - (d.expense_actual + d.expense_forecast);
      return {
        month: d.month,
        label: format(parse(d.month + "-01", "yyyy-MM-dd", new Date()), "MMM yy", { locale: it }),
        actual: isFuture ? null : actualNet,
        forecast: isFuture || isCurrent ? forecastNet : null,
      };
    });
  }, [data, todayMonth]);

  const todayIndex = series.findIndex((s) => s.month === todayMonth);
  const todayLabel = todayIndex >= 0 ? series[todayIndex].label : null;

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={series} margin={{ top: 5, right: 12, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatEURCompact(v)} />
        <Tooltip
          contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
          formatter={(v: number, name) => [formatEUR(v), name === "actual" ? "Consuntivo" : "Stima"]}
        />
        <Legend
          verticalAlign="top" align="right" height={28}
          formatter={(v) => (v === "actual" ? "Consuntivo" : "Previsionale")}
          wrapperStyle={{ fontSize: 11 }}
        />
        {todayLabel && (
          <ReferenceLine x={todayLabel} stroke="hsl(var(--muted-foreground))" strokeDasharray="2 4" label={{ value: "oggi", fontSize: 10, position: "insideTopRight" }} />
        )}
        <Line type="monotone" dataKey="actual" stroke="hsl(var(--primary))" strokeWidth={2.2} dot={false} connectNulls />
        <Line type="monotone" dataKey="forecast" stroke="hsl(var(--primary))" strokeWidth={2} strokeDasharray="5 4" dot={{ r: 3 }} connectNulls />
      </LineChart>
    </ResponsiveContainer>
  );
}
