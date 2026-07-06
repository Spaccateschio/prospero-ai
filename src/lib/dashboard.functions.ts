import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { addDays, addMonths, format, startOfMonth, subMonths } from "date-fns";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type TxInsert = {
  company_id: string;
  type: "entrata" | "uscita";
  amount: number;
  date: string;
  description: string | null;
  category: string | null;
  payment_method: string | null;
  status: "pending" | "confirmed" | "reconciled";
  is_forecast: boolean;
  recurrence?: "monthly" | "quarterly" | "yearly" | null;
  is_demo: boolean;
  created_by: string;
};

type InvInsert = {
  company_id: string;
  direction: "attiva" | "passiva";
  number: string;
  counterpart_name: string;
  amount: number;
  total_amount: number;
  vat_amount: number;
  issue_date: string;
  due_date: string;
  status: "draft" | "sent" | "paid" | "overdue" | "cancelled";
  is_demo: boolean;
};

export const getDashboardKPIs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ company_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const today = new Date();
    const monthStart = startOfMonth(today);
    const prevMonthStart = startOfMonth(subMonths(today, 1));
    const horizon30 = addDays(today, 30);

    const monthStartStr = format(monthStart, "yyyy-MM-dd");
    const prevMonthStartStr = format(prevMonthStart, "yyyy-MM-dd");
    const todayStr = format(today, "yyyy-MM-dd");

    // Fatture del mese corrente e precedente (per issue_date), escluse draft/cancelled.
    // Le note di credito si sottraggono.
    const [thisMonthInv, prevMonthInv, openInvoices, upcomingExpenses] = await Promise.all([
      supabase
        .from("invoices")
        .select("direction, total_amount, document_type, status")
        .eq("company_id", data.company_id)
        .not("status", "in", "(draft,cancelled)")
        .gte("issue_date", monthStartStr)
        .lte("issue_date", todayStr),
      supabase
        .from("invoices")
        .select("direction, total_amount, document_type, status")
        .eq("company_id", data.company_id)
        .not("status", "in", "(draft,cancelled)")
        .gte("issue_date", prevMonthStartStr)
        .lt("issue_date", monthStartStr),
      supabase
        .from("invoices")
        .select("id, total_amount, due_date, status")
        .eq("company_id", data.company_id)
        .in("status", ["sent", "overdue", "draft"]),
      supabase
        .from("transactions")
        .select("id, amount, date, description")
        .eq("company_id", data.company_id)
        .eq("type", "uscita")
        .gte("date", todayStr)
        .lte("date", format(horizon30, "yyyy-MM-dd"))
        .order("date", { ascending: true })
        .limit(5),
    ]);

    if (thisMonthInv.error) throw new Error(thisMonthInv.error.message);
    if (prevMonthInv.error) throw new Error(prevMonthInv.error.message);
    if (openInvoices.error) throw new Error(openInvoices.error.message);
    if (upcomingExpenses.error) throw new Error(upcomingExpenses.error.message);

    const signed = (row: { total_amount: number | string; document_type: string | null }) => {
      const amt = Number(row.total_amount);
      return row.document_type === "nota_credito" ? -amt : amt;
    };
    const sumByDir = (
      rows: { direction: string; total_amount: number | string; document_type: string | null }[],
      dir: "attiva" | "passiva",
    ) => rows.filter((r) => r.direction === dir).reduce((s, r) => s + signed(r), 0);

    const thisInc = sumByDir(thisMonthInv.data ?? [], "attiva");
    const thisExp = sumByDir(thisMonthInv.data ?? [], "passiva");
    const prevInc = sumByDir(prevMonthInv.data ?? [], "attiva");
    const prevExp = sumByDir(prevMonthInv.data ?? [], "passiva");
    const thisCashflow = thisInc - thisExp;
    const prevCashflow = prevInc - prevExp;

    const openInvoicesTotal = (openInvoices.data ?? []).reduce(
      (s, r) => s + Number(r.total_amount),
      0,
    );
    const openInvoicesCount = (openInvoices.data ?? []).length;

    return {
      revenue_month: thisInc,
      revenue_month_delta_pct: prevInc !== 0 ? ((thisInc - prevInc) / Math.abs(prevInc)) * 100 : null,
      expenses_month: thisExp,
      expenses_month_delta_pct: prevExp !== 0 ? ((thisExp - prevExp) / Math.abs(prevExp)) * 100 : null,
      cashflow_month: thisCashflow,
      cashflow_month_delta_pct:
        prevCashflow !== 0
          ? ((thisCashflow - prevCashflow) / Math.abs(prevCashflow)) * 100
          : null,
      open_invoices_total: openInvoicesTotal,
      open_invoices_count: openInvoicesCount,
      upcoming_expenses: (upcomingExpenses.data ?? []).map((r) => ({
        id: r.id as string,
        amount: Number(r.amount),
        date: r.date as string,
        description: (r.description as string) ?? null,
      })),
    };
  });


export const getTopExpenseCategories = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      company_id: z.string().uuid(),
      months: z.number().int().min(1).max(12).default(3),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const start = startOfMonth(subMonths(new Date(), data.months - 1));
    const { data: rows, error } = await supabase
      .from("transactions")
      .select("amount, category")
      .eq("company_id", data.company_id)
      .eq("type", "uscita")
      .eq("is_forecast", false)
      .gte("date", format(start, "yyyy-MM-dd"));
    if (error) throw new Error(error.message);
    const map = new Map<string, number>();
    for (const r of rows ?? []) {
      const k = (r.category as string) || "Senza categoria";
      map.set(k, (map.get(k) ?? 0) + Number(r.amount));
    }
    return Array.from(map.entries())
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);
  });

async function assertOwnerOrAdmin(
  supabase: { from: (t: string) => { select: (s: string) => { eq: (c: string, v: string) => { eq: (c: string, v: string) => { maybeSingle: () => Promise<{ data: { role: string } | null; error: { message: string } | null }> } } } } },
  companyId: string,
  userId: string,
) {
  const { data, error } = await supabase
    .from("company_users")
    .select("role")
    .eq("company_id", companyId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Non sei membro di questa azienda");
  if (!["owner", "admin"].includes(data.role)) {
    throw new Error("Solo owner e admin possono gestire i dati demo");
  }
}

export const seedDemoData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ company_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertOwnerOrAdmin(supabase as never, data.company_id, userId);

    await supabase.from("transactions").delete().eq("company_id", data.company_id).eq("is_demo", true);
    await supabase.from("invoices").delete().eq("company_id", data.company_id).eq("is_demo", true);

    const today = new Date();
    const txs: TxInsert[] = [];

    for (let i = 5; i >= 0; i--) {
      const m = startOfMonth(subMonths(today, i));
      txs.push({
        company_id: data.company_id,
        type: "entrata",
        amount: 12000 + Math.round(Math.random() * 8000),
        date: format(addDays(m, 5), "yyyy-MM-dd"),
        description: "Incasso vendite mensili",
        category: "Vendite",
        payment_method: "bonifico",
        status: "confirmed",
        is_forecast: false,
        is_demo: true,
        created_by: userId,
      });
      txs.push({
        company_id: data.company_id,
        type: "entrata",
        amount: 3500 + Math.round(Math.random() * 2000),
        date: format(addDays(m, 18), "yyyy-MM-dd"),
        description: "Servizi consulenza",
        category: "Servizi",
        payment_method: "bonifico",
        status: "confirmed",
        is_forecast: false,
        is_demo: true,
        created_by: userId,
      });
      txs.push({
        company_id: data.company_id,
        type: "uscita",
        amount: 2800,
        date: format(addDays(m, 1), "yyyy-MM-dd"),
        description: "Affitto sede",
        category: "Affitto",
        payment_method: "bonifico",
        status: "confirmed",
        is_forecast: false,
        is_demo: true,
        created_by: userId,
      });
      txs.push({
        company_id: data.company_id,
        type: "uscita",
        amount: 6500,
        date: format(addDays(m, 27), "yyyy-MM-dd"),
        description: "Stipendi dipendenti",
        category: "Personale",
        payment_method: "bonifico",
        status: "confirmed",
        is_forecast: false,
        is_demo: true,
        created_by: userId,
      });
      txs.push({
        company_id: data.company_id,
        type: "uscita",
        amount: 1200 + Math.round(Math.random() * 600),
        date: format(addDays(m, 10), "yyyy-MM-dd"),
        description: "Fornitori materie prime",
        category: "Fornitori",
        payment_method: "bonifico",
        status: "confirmed",
        is_forecast: false,
        is_demo: true,
        created_by: userId,
      });
      txs.push({
        company_id: data.company_id,
        type: "uscita",
        amount: 380,
        date: format(addDays(m, 15), "yyyy-MM-dd"),
        description: "Utenze (luce, gas, internet)",
        category: "Utenze",
        payment_method: "addebito",
        status: "confirmed",
        is_forecast: false,
        is_demo: true,
        created_by: userId,
      });
    }

    const nextMonth = startOfMonth(addMonths(today, 1));
    txs.push({
      company_id: data.company_id,
      type: "uscita",
      amount: 2800,
      date: format(addDays(nextMonth, 1), "yyyy-MM-dd"),
      description: "Affitto sede (ricorrente)",
      category: "Affitto",
      payment_method: "bonifico",
      status: "pending",
      is_forecast: false,
      recurrence: "monthly",
      is_demo: true,
      created_by: userId,
    });
    txs.push({
      company_id: data.company_id,
      type: "uscita",
      amount: 6500,
      date: format(addDays(nextMonth, 27), "yyyy-MM-dd"),
      description: "Stipendi (ricorrente)",
      category: "Personale",
      payment_method: "bonifico",
      status: "pending",
      is_forecast: false,
      recurrence: "monthly",
      is_demo: true,
      created_by: userId,
    });

    txs.push({
      company_id: data.company_id,
      type: "uscita",
      amount: 4500,
      date: format(addDays(today, 20), "yyyy-MM-dd"),
      description: "Acquisto attrezzatura (previsto)",
      category: "Investimenti",
      payment_method: "bonifico",
      status: "pending",
      is_forecast: true,
      is_demo: true,
      created_by: userId,
    });

    const { error: txErr } = await supabase.from("transactions").insert(txs);
    if (txErr) throw new Error(txErr.message);

    const inv: InvInsert[] = [
      {
        company_id: data.company_id,
        direction: "attiva",
        number: "DEMO-2025-001",
        counterpart_name: "Cliente ACME S.r.l.",
        amount: 4500,
        total_amount: 5490,
        vat_amount: 990,
        issue_date: format(subMonths(today, 1), "yyyy-MM-dd"),
        due_date: format(addDays(today, 15), "yyyy-MM-dd"),
        status: "sent",
        is_demo: true,
      },
      {
        company_id: data.company_id,
        direction: "attiva",
        number: "DEMO-2025-002",
        counterpart_name: "Cliente Bianchi & Co.",
        amount: 2800,
        total_amount: 3416,
        vat_amount: 616,
        issue_date: format(subMonths(today, 2), "yyyy-MM-dd"),
        due_date: format(addDays(today, -5), "yyyy-MM-dd"),
        status: "overdue",
        is_demo: true,
      },
    ];

    const { error: invErr } = await supabase.from("invoices").insert(inv);
    if (invErr) throw new Error(invErr.message);

    return { transactions: txs.length, invoices: inv.length };
  });

export const clearDemoData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ company_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertOwnerOrAdmin(supabase as never, data.company_id, userId);
    const [txDel, invDel] = await Promise.all([
      supabase.from("transactions").delete().eq("company_id", data.company_id).eq("is_demo", true),
      supabase.from("invoices").delete().eq("company_id", data.company_id).eq("is_demo", true),
    ]);
    if (txDel.error) throw new Error(txDel.error.message);
    if (invDel.error) throw new Error(invDel.error.message);
    return { ok: true as const };
  });

export const countDemoData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ company_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const [tx, inv] = await Promise.all([
      supabase.from("transactions").select("id", { count: "exact", head: true }).eq("company_id", data.company_id).eq("is_demo", true),
      supabase.from("invoices").select("id", { count: "exact", head: true }).eq("company_id", data.company_id).eq("is_demo", true),
    ]);
    return {
      transactions: tx.count ?? 0,
      invoices: inv.count ?? 0,
    };
  });
