import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { addDays, format, parseISO, addMonths, addQuarters, addYears } from "date-fns";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getForecast } from "@/lib/cashflow.functions";

// Alert live, on-demand, MAI persistiti. La tabella `notifications`
// resta per la Fase 3 (push/email/persistenza con stato letta/snooze).
export type AlertSeverity = "info" | "warning" | "danger";
export type AlertKind =
  | "cash_below_threshold"
  | "invoice_overdue"
  | "deadline_soon"
  | "loan_due_soon";

export type AlertItem = {
  id: string;             // stabile per de-dup (kind:entityId)
  kind: AlertKind;
  severity: AlertSeverity;
  title: string;
  description: string;
  amount: number | null;
  date: string | null;    // data rilevante (scadenza/giorno minimo)
  entity_id: string | null;
  href: "/accounting" | "/financing" | "/tax-calendar" | "/cash-flow";
};

const SOON_DAYS = 7;

export const listAlerts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ company_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const today = new Date();
    const todayStr = format(today, "yyyy-MM-dd");
    const soonStr = format(addDays(today, SOON_DAYS), "yyyy-MM-dd");

    const alerts: AlertItem[] = [];

    // --- 1) Cassa sotto soglia (su forecast 30gg, MINIMO cumulato) ---
    const { data: company, error: compErr } = await supabase
      .from("companies")
      .select("cashflow_alert_threshold, name")
      .eq("id", data.company_id)
      .single();
    if (compErr) throw new Error(compErr.message);

    const threshold = company?.cashflow_alert_threshold;
    // null → alert disattivato. NON trattiamo null come 0.
    if (threshold !== null && threshold !== undefined) {
      const thr = Number(threshold);
      // Riusa getForecast (include proiezioni live invoice/loan/deadline)
      const fc = await getForecast({ data: { company_id: data.company_id, days: 30 } });
      let minBal = fc.opening_balance;
      let minDate = todayStr;
      for (const d of fc.daily) {
        if (d.balance < minBal) {
          minBal = d.balance;
          minDate = d.date;
        }
      }
      if (minBal < thr) {
        alerts.push({
          id: "cash_below_threshold",
          kind: "cash_below_threshold",
          severity: minBal < 0 ? "danger" : "warning",
          title: "Cassa sotto soglia",
          description: `Saldo minimo previsto € ${minBal.toFixed(2)} il ${minDate} (soglia € ${thr.toFixed(2)})`,
          amount: minBal,
          date: minDate,
          entity_id: null,
          href: "/cash-flow",
        });
      }
    }

    // --- 2) Fatture scadute (effective_status overdue) ---
    const { data: invoices, error: invErr } = await supabase
      .from("invoices")
      .select("id, number, counterpart_name, total_amount, paid_amount, due_date, status, direction")
      .eq("company_id", data.company_id)
      .in("status", ["sent", "partially_paid"])
      .lt("due_date", todayStr);
    if (invErr) throw new Error(invErr.message);
    for (const inv of invoices ?? []) {
      const residual = Math.max(0, Number(inv.total_amount) - Number(inv.paid_amount ?? 0));
      if (residual <= 0) continue;
      const label = inv.direction === "attiva" ? "Fattura attiva scaduta" : "Fattura passiva scaduta";
      alerts.push({
        id: `invoice_overdue:${inv.id}`,
        kind: "invoice_overdue",
        severity: "danger",
        title: label,
        description: `${inv.number ? `#${inv.number} · ` : ""}${inv.counterpart_name} — residuo € ${residual.toFixed(2)} (scaduta il ${inv.due_date})`,
        amount: residual,
        date: inv.due_date as string,
        entity_id: inv.id as string,
        href: "/accounting",
      });
    }

    // --- 3) Scadenze imminenti entro 7gg (pending, due_date in [today, today+7]) ---
    const { data: deadlines, error: dlErr } = await supabase
      .from("deadlines")
      .select("id, title, category, kind, estimated_amount, due_date, status")
      .eq("company_id", data.company_id)
      .eq("status", "pending")
      .gte("due_date", todayStr)
      .lte("due_date", soonStr);
    if (dlErr) throw new Error(dlErr.message);
    for (const dl of deadlines ?? []) {
      alerts.push({
        id: `deadline_soon:${dl.id}`,
        kind: "deadline_soon",
        severity: "warning",
        title: `Scadenza imminente${dl.kind === "tax" ? " (fiscale)" : ""}`,
        description: `${dl.title}${dl.category ? ` · ${dl.category}` : ""} — ${dl.due_date}`,
        amount: dl.estimated_amount != null ? Number(dl.estimated_amount) : null,
        date: dl.due_date as string,
        entity_id: dl.id as string,
        href: "/tax-calendar",
      });
    }

    // --- 4) Rate finanziamenti in arrivo entro 7gg ---
    const { data: loans, error: loanErr } = await supabase
      .from("loans")
      .select("id, name, lender, installment, frequency, next_due_date, paid_installments, total_installments, status")
      .eq("company_id", data.company_id)
      .eq("status", "active");
    if (loanErr) throw new Error(loanErr.message);
    for (const l of loans ?? []) {
      if (!l.next_due_date) continue;
      // Considera la prossima rata; se cade nella finestra → alert.
      // Se è già scaduta (< today) → severity danger.
      const nextStr = l.next_due_date as string;
      const isOverdue = nextStr < todayStr;
      const inWindow = nextStr >= todayStr && nextStr <= soonStr;
      if (!isOverdue && !inWindow) continue;
      // (Difensivo, oggi non lo usiamo) — se in futuro vorremo includere anche rate successive
      // nello stesso orizzonte 7gg, usare addMonths/addQuarters/addYears su `l.frequency`.
      void addMonths; void addQuarters; void addYears; void parseISO;
      alerts.push({
        id: `loan_due_soon:${l.id}`,
        kind: "loan_due_soon",
        severity: isOverdue ? "danger" : "warning",
        title: isOverdue ? "Rata finanziamento scaduta" : "Rata finanziamento in arrivo",
        description: `${l.name}${l.lender ? ` · ${l.lender}` : ""} — rata ${Number(l.paid_installments) + 1}/${l.total_installments} il ${nextStr} (€ ${Number(l.installment).toFixed(2)})`,
        amount: Number(l.installment),
        date: nextStr,
        entity_id: l.id as string,
        href: "/financing",
      });
    }

    // Ordina: danger → warning → info, poi per data ascendente
    const sevRank: Record<AlertSeverity, number> = { danger: 0, warning: 1, info: 2 };
    alerts.sort((a, b) => {
      const s = sevRank[a.severity] - sevRank[b.severity];
      if (s !== 0) return s;
      return (a.date ?? "").localeCompare(b.date ?? "");
    });

    return {
      alerts,
      count: alerts.length,
      by_kind: alerts.reduce<Record<AlertKind, number>>((acc, a) => {
        acc[a.kind] = (acc[a.kind] ?? 0) + 1;
        return acc;
      }, { cash_below_threshold: 0, invoice_overdue: 0, deadline_soon: 0, loan_due_soon: 0 }),
    };
  });
