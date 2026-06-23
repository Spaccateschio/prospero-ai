import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { addMonths, addQuarters, addYears, format, parseISO, startOfMonth, endOfMonth, subMonths } from "date-fns";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const TransactionTypeEnum = z.enum(["entrata", "uscita"]);
const RecurrenceEnum = z.enum(["monthly", "quarterly", "yearly"]);
const StatusEnum = z.enum(["pending", "confirmed", "reconciled"]);

const UpsertSchema = z.object({
  id: z.string().uuid().optional(),
  company_id: z.string().uuid(),
  type: TransactionTypeEnum,
  amount: z.number().positive(),
  date: z.string().min(8),
  description: z.string().trim().max(300).optional().nullable(),
  category: z.string().trim().max(80).optional().nullable(),
  counterpart: z.string().trim().max(160).optional().nullable(),
  payment_method: z.string().trim().max(40).optional().nullable(),
  status: StatusEnum.optional(),
  is_forecast: z.boolean().optional(),
  recurrence: RecurrenceEnum.optional().nullable(),
});

async function getMembershipRole(
  supabase: { from: (t: string) => { select: (s: string) => { eq: (c: string, v: string) => { eq: (c: string, v: string) => { maybeSingle: () => Promise<{ data: { role: string } | null; error: { message: string } | null }> } } } } },
  companyId: string,
  userId: string,
): Promise<string> {
  const { data, error } = await supabase
    .from("company_users")
    .select("role")
    .eq("company_id", companyId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Non sei membro di questa azienda");
  return data.role;
}

// ============ LIST ============
export const listTransactions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      company_id: z.string().uuid(),
      from: z.string().optional(),
      to: z.string().optional(),
      type: TransactionTypeEnum.optional(),
      include_forecast: z.boolean().optional(),
      category: z.string().optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from("transactions")
      .select("*")
      .eq("company_id", data.company_id)
      .order("date", { ascending: false });
    if (data.from) q = q.gte("date", data.from);
    if (data.to) q = q.lte("date", data.to);
    if (data.type) q = q.eq("type", data.type);
    if (data.category) q = q.eq("category", data.category);
    if (data.include_forecast === false) q = q.eq("is_forecast", false);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

// ============ UPSERT ============
export const upsertTransaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => UpsertSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const role = await getMembershipRole(supabase as never, data.company_id, userId);
    if (!["owner", "admin", "accountant"].includes(role)) {
      throw new Error("Permessi insufficienti per modificare i movimenti");
    }
    const payload = {
      company_id: data.company_id,
      type: data.type,
      amount: data.amount,
      date: data.date,
      description: data.description ?? null,
      category: data.category ?? null,
      counterpart: data.counterpart ?? null,
      payment_method: data.payment_method ?? null,
      status: data.status ?? "confirmed",
      is_forecast: data.is_forecast ?? false,
      recurrence: data.recurrence ?? null,
      created_by: userId,
    };
    if (data.id) {
      const { error } = await supabase.from("transactions").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: inserted, error } = await supabase
      .from("transactions")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: inserted.id };
  });

// ============ DELETE ============
export const deleteTransaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), company_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const role = await getMembershipRole(supabase as never, data.company_id, userId);
    if (!["owner", "admin"].includes(role)) {
      throw new Error("Solo owner e admin possono eliminare movimenti");
    }
    const { error } = await supabase.from("transactions").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

// ============ SUMMARY ============
type MonthBucket = { month: string; income_actual: number; expense_actual: number; income_forecast: number; expense_forecast: number };

function projectRecurrences(
  rows: { date: string; amount: number; type: string; recurrence: string | null }[],
  horizonEnd: Date,
): { date: string; amount: number; type: string }[] {
  const projected: { date: string; amount: number; type: string }[] = [];
  for (const r of rows) {
    if (!r.recurrence) continue;
    const step = r.recurrence;
    let cursor = parseISO(r.date);
    while (true) {
      cursor =
        step === "monthly" ? addMonths(cursor, 1)
        : step === "quarterly" ? addQuarters(cursor, 1)
        : addYears(cursor, 1);
      if (cursor > horizonEnd) break;
      projected.push({
        date: format(cursor, "yyyy-MM-dd"),
        amount: Number(r.amount),
        type: r.type,
      });
    }
  }
  return projected;
}

// Proiezioni "live" da entità collegate (fatture, finanziamenti, scadenze).
// NON sono righe in transactions: vengono ricalcolate ad ogni read.
// Quando il pagamento viene registrato (record*Payment / markDeadlinePaid),
// nasce una transaction reale con origin=invoice|loan|deadline e
// source_*_id valorizzato → anti-duplicato.
type LiveProjection = {
  date: string;
  amount: number;
  type: "entrata" | "uscita";
  description: string | null;
  category: string | null;
  origin: "invoice" | "loan" | "deadline";
  origin_id: string;
  counterpart: string | null;
};

async function buildLiveProjections(
  supabase: unknown,
  companyId: string,
  todayStr: string,
  horizonEndStr: string,
): Promise<LiveProjection[]> {
  const sb = supabase as {
    from: (t: string) => {
      select: (s: string) => unknown;
    };
  };
  const out: LiveProjection[] = [];

  // 1) Fatture aperte (non pagate / parziali) con due_date nell'orizzonte
  const invQ = (sb.from("invoices").select("id, direction, number, counterpart_name, total_amount, paid_amount, due_date, status") as never as {
    eq: (c: string, v: string) => {
      in: (c: string, v: string[]) => {
        gte: (c: string, v: string) => {
          lte: (c: string, v: string) => Promise<{ data: Array<{
            id: string; direction: "attiva" | "passiva"; number: string | null;
            counterpart_name: string; total_amount: number; paid_amount: number;
            due_date: string; status: string;
          }> | null; error: { message: string } | null }>;
        };
      };
    };
  })
    .eq("company_id", companyId)
    .in("status", ["sent", "partially_paid"])
    .gte("due_date", todayStr)
    .lte("due_date", horizonEndStr);
  const { data: invoices, error: invErr } = await invQ;
  if (invErr) throw new Error(invErr.message);
  for (const inv of invoices ?? []) {
    const residual = Math.max(0, Number(inv.total_amount) - Number(inv.paid_amount ?? 0));
    if (residual <= 0) continue;
    out.push({
      date: inv.due_date,
      amount: residual,
      type: inv.direction === "attiva" ? "entrata" : "uscita",
      description: inv.number ? `Fattura ${inv.number}` : `Fattura ${inv.direction}`,
      category: inv.direction === "attiva" ? "Fatture attive" : "Fatture passive",
      origin: "invoice",
      origin_id: inv.id,
      counterpart: inv.counterpart_name,
    });
  }

  // 2) Rate finanziamenti attivi: avanza da next_due_date secondo frequency
  const loanQ = (sb.from("loans").select("id, name, lender, installment, frequency, next_due_date, end_date, status, paid_installments, total_installments") as never as {
    eq: (c: string, v: string) => {
      eq: (c: string, v: string) => Promise<{ data: Array<{
        id: string; name: string; lender: string | null;
        installment: number; frequency: "monthly" | "quarterly" | "yearly";
        next_due_date: string | null; end_date: string | null;
        status: string; paid_installments: number; total_installments: number;
      }> | null; error: { message: string } | null }>;
    };
  })
    .eq("company_id", companyId)
    .eq("status", "active");
  const { data: loans, error: loanErr } = await loanQ;
  if (loanErr) throw new Error(loanErr.message);
  for (const l of loans ?? []) {
    if (!l.next_due_date) continue;
    const installment = Number(l.installment);
    if (!Number.isFinite(installment) || installment <= 0) continue;
    let cursor = parseISO(l.next_due_date);
    let remaining = Math.max(0, Number(l.total_installments) - Number(l.paid_installments ?? 0));
    const endLimit = l.end_date ? parseISO(l.end_date) : null;
    while (remaining > 0) {
      const dStr = format(cursor, "yyyy-MM-dd");
      if (dStr > horizonEndStr) break;
      if (endLimit && cursor > endLimit) break;
      if (dStr >= todayStr) {
        out.push({
          date: dStr,
          amount: installment,
          type: "uscita",
          description: `Rata ${l.name}`,
          category: "Finanziamenti",
          origin: "loan",
          origin_id: l.id,
          counterpart: l.lender,
        });
      }
      remaining -= 1;
      cursor =
        l.frequency === "monthly" ? addMonths(cursor, 1)
        : l.frequency === "quarterly" ? addQuarters(cursor, 1)
        : addYears(cursor, 1);
    }
  }

  // 3) Scadenze pending con importo stimato > 0
  const dlQ = (sb.from("deadlines").select("id, title, category, kind, estimated_amount, due_date, status, recurrence") as never as {
    eq: (c: string, v: string) => {
      eq: (c: string, v: string) => {
        gte: (c: string, v: string) => {
          lte: (c: string, v: string) => Promise<{ data: Array<{
            id: string; title: string; category: string | null; kind: string;
            estimated_amount: number | null; due_date: string; status: string;
            recurrence: "monthly" | "quarterly" | "yearly" | null;
          }> | null; error: { message: string } | null }>;
        };
      };
    };
  })
    .eq("company_id", companyId)
    .eq("status", "pending")
    .gte("due_date", todayStr)
    .lte("due_date", horizonEndStr);
  const { data: deadlines, error: dlErr } = await dlQ;
  if (dlErr) throw new Error(dlErr.message);
  for (const d of deadlines ?? []) {
    const amt = Number(d.estimated_amount ?? 0);
    if (amt <= 0) continue;
    out.push({
      date: d.due_date,
      amount: amt,
      type: "uscita",
      description: d.title,
      category: d.category ?? (d.kind === "tax" ? "Fiscale" : "Scadenze"),
      origin: "deadline",
      origin_id: d.id,
      counterpart: null,
    });
  }

  return out;
}

export const getCashflowSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      company_id: z.string().uuid(),
      months_back: z.number().int().min(1).max(24).default(6),
      months_forward: z.number().int().min(0).max(12).default(3),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const today = new Date();
    const start = startOfMonth(subMonths(today, data.months_back - 1));
    const horizonEnd = endOfMonth(addMonths(today, data.months_forward));
    const todayStr = format(today, "yyyy-MM-dd");
    const horizonEndStr = format(horizonEnd, "yyyy-MM-dd");

    const { data: rows, error } = await supabase
      .from("transactions")
      .select("date, amount, type, recurrence, is_forecast")
      .eq("company_id", data.company_id)
      .gte("date", format(start, "yyyy-MM-dd"))
      .lte("date", horizonEndStr);
    if (error) throw new Error(error.message);

    const { data: recurringAll, error: recErr } = await supabase
      .from("transactions")
      .select("date, amount, type, recurrence")
      .eq("company_id", data.company_id)
      .not("recurrence", "is", null);
    if (recErr) throw new Error(recErr.message);

    const projected = projectRecurrences(
      (recurringAll ?? []).map((r) => ({
        date: r.date as string,
        amount: Number(r.amount),
        type: r.type as string,
        recurrence: r.recurrence as string | null,
      })),
      horizonEnd,
    );

    // Proiezioni live (fatture/loan/scadenze) → forecast dei mesi futuri
    const live = await buildLiveProjections(supabase as never, data.company_id, todayStr, horizonEndStr);

    const buckets: Record<string, MonthBucket> = {};
    for (let i = 0; i < data.months_back + data.months_forward + 1; i++) {
      const m = format(addMonths(start, i), "yyyy-MM");
      buckets[m] = { month: m, income_actual: 0, expense_actual: 0, income_forecast: 0, expense_forecast: 0 };
    }

    const todayKey = format(today, "yyyy-MM");

    for (const r of rows ?? []) {
      const m = (r.date as string).slice(0, 7);
      if (!buckets[m]) continue;
      const amt = Number(r.amount);
      if (r.is_forecast) {
        if (r.type === "entrata") buckets[m].income_forecast += amt;
        else buckets[m].expense_forecast += amt;
      } else {
        if (r.type === "entrata") buckets[m].income_actual += amt;
        else buckets[m].expense_actual += amt;
      }
    }

    for (const p of projected) {
      const m = p.date.slice(0, 7);
      if (!buckets[m]) continue;
      if (m < todayKey) continue;
      if (p.type === "entrata") buckets[m].income_forecast += p.amount;
      else buckets[m].expense_forecast += p.amount;
    }

    for (const lp of live) {
      const m = lp.date.slice(0, 7);
      if (!buckets[m]) continue;
      if (m < todayKey) continue;
      if (lp.type === "entrata") buckets[m].income_forecast += lp.amount;
      else buckets[m].expense_forecast += lp.amount;
    }

    const months = Object.values(buckets).sort((a, b) => a.month.localeCompare(b.month));
    return { months, today_month: todayKey };
  });

// ============ FORECAST (unificato) ============
// Sorgenti proiettate (mai scritte in transactions):
//  - transactions is_forecast=true one-off + ricorrenze (origin one_off/recurring)
//  - fatture aperte (sent/partially_paid) → entrata/uscita per direction (origin=invoice)
//  - rate finanziamenti active proiettate per frequency fino a end_date (origin=loan)
//  - deadlines pending con estimated_amount > 0 (origin=deadline)
// Ogni item porta origin + origin_id per tracciabilità.
export const getForecast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      company_id: z.string().uuid(),
      days: z.union([z.literal(30), z.literal(60), z.literal(90)]).default(30),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const today = new Date();
    const horizonEnd = new Date(today);
    horizonEnd.setDate(horizonEnd.getDate() + data.days);
    const todayStr = format(today, "yyyy-MM-dd");
    const horizonEndStr = format(horizonEnd, "yyyy-MM-dd");

    // Saldo di partenza = somma di tutti i movimenti reali (is_forecast=false) fino a oggi
    const { data: pastReal, error: pastErr } = await supabase
      .from("transactions")
      .select("amount, type")
      .eq("company_id", data.company_id)
      .eq("is_forecast", false)
      .lte("date", todayStr);
    if (pastErr) throw new Error(pastErr.message);
    let openingBalance = 0;
    for (const r of pastReal ?? []) {
      openingBalance += (r.type === "entrata" ? 1 : -1) * Number(r.amount);
    }

    // Forecast one-off
    const { data: oneOff, error: oneErr } = await supabase
      .from("transactions")
      .select("id, date, amount, type, description, category")
      .eq("company_id", data.company_id)
      .eq("is_forecast", true)
      .is("recurrence", null)
      .gte("date", todayStr)
      .lte("date", horizonEndStr);
    if (oneErr) throw new Error(oneErr.message);

    // Ricorrenti da transactions
    const { data: recurring, error: recErr } = await supabase
      .from("transactions")
      .select("id, date, amount, type, description, category, recurrence")
      .eq("company_id", data.company_id)
      .not("recurrence", "is", null);
    if (recErr) throw new Error(recErr.message);

    type ForecastItem = {
      date: string; amount: number; type: string;
      description: string | null; category: string | null;
      origin: "one_off" | "recurring" | "invoice" | "loan" | "deadline";
      origin_id: string;
      counterpart: string | null;
    };
    const items: ForecastItem[] = [];

    for (const r of oneOff ?? []) {
      items.push({
        date: r.date as string,
        amount: Number(r.amount),
        type: r.type as string,
        description: (r.description as string) ?? null,
        category: (r.category as string) ?? null,
        origin: "one_off",
        origin_id: r.id as string,
        counterpart: null,
      });
    }

    for (const r of recurring ?? []) {
      const step = r.recurrence as string;
      let cursor = parseISO(r.date as string);
      while (true) {
        cursor =
          step === "monthly" ? addMonths(cursor, 1)
          : step === "quarterly" ? addQuarters(cursor, 1)
          : addYears(cursor, 1);
        const dStr = format(cursor, "yyyy-MM-dd");
        if (dStr > horizonEndStr) break;
        if (dStr < todayStr) continue;
        items.push({
          date: dStr,
          amount: Number(r.amount),
          type: r.type as string,
          description: (r.description as string) ?? null,
          category: (r.category as string) ?? null,
          origin: "recurring",
          origin_id: r.id as string,
          counterpart: null,
        });
      }
    }

    // Proiezioni live unificate
    const live = await buildLiveProjections(supabase as never, data.company_id, todayStr, horizonEndStr);
    for (const lp of live) items.push(lp);

    items.sort((a, b) => a.date.localeCompare(b.date));

    let runningBalance = openingBalance;
    const byDay = new Map<string, { in: number; out: number }>();
    for (const it of items) {
      const cur = byDay.get(it.date) ?? { in: 0, out: 0 };
      if (it.type === "entrata") cur.in += it.amount;
      else cur.out += it.amount;
      byDay.set(it.date, cur);
    }
    const sortedDays = Array.from(byDay.keys()).sort();
    const daily: { date: string; balance: number; in: number; out: number }[] = [
      { date: todayStr, balance: openingBalance, in: 0, out: 0 },
    ];
    for (const d of sortedDays) {
      const v = byDay.get(d)!;
      runningBalance += v.in - v.out;
      daily.push({ date: d, balance: runningBalance, in: v.in, out: v.out });
    }

    // Riepilogo per origin per la UI
    const by_origin: Record<string, { in: number; out: number; count: number }> = {};
    for (const it of items) {
      const k = it.origin;
      const cur = by_origin[k] ?? { in: 0, out: 0, count: 0 };
      if (it.type === "entrata") cur.in += it.amount;
      else cur.out += it.amount;
      cur.count += 1;
      by_origin[k] = cur;
    }

    return {
      opening_balance: openingBalance,
      closing_balance: runningBalance,
      items,
      daily,
      by_origin,
      horizon_days: data.days,
    };
  });


// ============ CATEGORIES ============
export const listCategories = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ company_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("transaction_categories")
      .select("*")
      .eq("company_id", data.company_id)
      .order("type", { ascending: true })
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const upsertCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      id: z.string().uuid().optional(),
      company_id: z.string().uuid(),
      name: z.string().trim().min(1).max(80),
      type: z.enum(["income", "expense"]),
      color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    if (data.id) {
      const { error } = await supabase
        .from("transaction_categories")
        .update({ name: data.name, type: data.type, color: data.color })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: ins, error } = await supabase
      .from("transaction_categories")
      .insert({ company_id: data.company_id, name: data.name, type: data.type, color: data.color })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: ins.id };
  });

export const deleteCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("transaction_categories").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
