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

    const { data: rows, error } = await supabase
      .from("transactions")
      .select("date, amount, type, recurrence, is_forecast")
      .eq("company_id", data.company_id)
      .gte("date", format(start, "yyyy-MM-dd"))
      .lte("date", format(horizonEnd, "yyyy-MM-dd"));
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

    const months = Object.values(buckets).sort((a, b) => a.month.localeCompare(b.month));
    return { months, today_month: todayKey };
  });

// ============ FORECAST ============
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

    const { data: pastReal, error: pastErr } = await supabase
      .from("transactions")
      .select("amount, type")
      .eq("company_id", data.company_id)
      .eq("is_forecast", false)
      .lte("date", format(today, "yyyy-MM-dd"));
    if (pastErr) throw new Error(pastErr.message);
    let openingBalance = 0;
    for (const r of pastReal ?? []) {
      openingBalance += (r.type === "entrata" ? 1 : -1) * Number(r.amount);
    }

    const { data: oneOff, error: oneErr } = await supabase
      .from("transactions")
      .select("id, date, amount, type, description, category")
      .eq("company_id", data.company_id)
      .eq("is_forecast", true)
      .is("recurrence", null)
      .gte("date", format(today, "yyyy-MM-dd"))
      .lte("date", format(horizonEnd, "yyyy-MM-dd"));
    if (oneErr) throw new Error(oneErr.message);

    const { data: recurring, error: recErr } = await supabase
      .from("transactions")
      .select("id, date, amount, type, description, category, recurrence")
      .eq("company_id", data.company_id)
      .not("recurrence", "is", null);
    if (recErr) throw new Error(recErr.message);

    type ForecastItem = {
      date: string; amount: number; type: string;
      description: string | null; category: string | null;
      origin: "one_off" | "recurring";
      origin_id: string;
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
      });
    }
    const horizonEndStr = format(horizonEnd, "yyyy-MM-dd");
    const todayStr = format(today, "yyyy-MM-dd");
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
        });
      }
    }

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

    return {
      opening_balance: openingBalance,
      closing_balance: runningBalance,
      items,
      daily,
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
