import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { addMonths, addQuarters, addYears, parseISO, format } from "date-fns";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const FrequencyEnum = z.enum(["monthly", "quarterly", "yearly"]);
const RateTypeEnum = z.enum(["fisso", "variabile", "misto"]);
// status non è writable da upsert: passa automaticamente a 'paid_off' quando le rate sono completate.
const WritableStatusEnum = z.enum(["active", "defaulted"]);

const UpsertLoanSchema = z.object({
  id: z.string().uuid().optional(),
  company_id: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  lender: z.string().trim().max(160).optional().nullable(),
  initial_amount: z.number().positive(),
  rate_type: RateTypeEnum.default("fisso"),
  rate_value: z.number().nonnegative().optional().nullable(),
  installment: z.number().positive(),
  total_installments: z.number().int().positive(),
  frequency: FrequencyEnum.default("monthly"),
  start_date: z.string().optional().nullable(),
  next_due_date: z.string().optional().nullable(),
  status: WritableStatusEnum.optional(),
  notes: z.string().trim().max(1000).optional().nullable(),
});

type Membership = {
  from: (t: string) => {
    select: (s: string) => {
      eq: (c: string, v: string) => {
        eq: (c: string, v: string) => {
          maybeSingle: () => Promise<{ data: { role: string } | null; error: { message: string } | null }>;
        };
      };
    };
  };
};

async function getMembershipRole(supabase: Membership, companyId: string, userId: string): Promise<string> {
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

function advanceDate(d: Date, frequency: "monthly" | "quarterly" | "yearly"): Date {
  if (frequency === "monthly") return addMonths(d, 1);
  if (frequency === "quarterly") return addQuarters(d, 1);
  return addYears(d, 1);
}

function computeEndDate(start: Date, frequency: "monthly" | "quarterly" | "yearly", total: number): string {
  if (frequency === "monthly") return format(addMonths(start, total), "yyyy-MM-dd");
  if (frequency === "quarterly") return format(addQuarters(start, total), "yyyy-MM-dd");
  return format(addYears(start, total), "yyyy-MM-dd");
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ============ LIST ============
export const listLoans = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      company_id: z.string().uuid(),
      status: z.enum(["active", "paid_off", "defaulted"]).optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from("loans")
      .select("*")
      .eq("company_id", data.company_id)
      .order("created_at", { ascending: false });
    if (data.status) q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

// ============ UPSERT ============
export const upsertLoan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => UpsertLoanSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const role = await getMembershipRole(supabase as never, data.company_id, userId);
    if (!["owner", "admin", "accountant"].includes(role)) {
      throw new Error("Permessi insufficienti per modificare i finanziamenti");
    }

    const startStr = data.start_date || format(new Date(), "yyyy-MM-dd");
    const start = parseISO(startStr);
    const endStr = computeEndDate(start, data.frequency, data.total_installments);
    const nextDueStr = data.next_due_date || format(advanceDate(start, data.frequency), "yyyy-MM-dd");

    if (data.id) {
      // Update: preserva paid_installments e ricalcola residuo coerente
      const { data: existing, error: exErr } = await supabase
        .from("loans")
        .select("paid_installments, status")
        .eq("id", data.id)
        .single();
      if (exErr) throw new Error(exErr.message);
      const paid = Number(existing.paid_installments ?? 0);
      const residual = paid >= data.total_installments
        ? 0
        : round2(data.initial_amount * (1 - paid / data.total_installments));
      const newStatus = paid >= data.total_installments ? "paid_off" : (data.status ?? existing.status ?? "active");

      const payload = {
        name: data.name,
        lender: data.lender ?? null,
        initial_amount: data.initial_amount,
        rate_type: data.rate_type,
        rate_value: data.rate_value ?? null,
        installment: data.installment,
        total_installments: data.total_installments,
        frequency: data.frequency,
        start_date: startStr,
        end_date: endStr,
        next_due_date: newStatus === "paid_off" ? null : nextDueStr,
        residual,
        status: newStatus,
        notes: data.notes ?? null,
      };
      const { error } = await supabase.from("loans").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }

    const payload = {
      company_id: data.company_id,
      name: data.name,
      lender: data.lender ?? null,
      initial_amount: data.initial_amount,
      residual: data.initial_amount,
      rate_type: data.rate_type,
      rate_value: data.rate_value ?? null,
      installment: data.installment,
      total_installments: data.total_installments,
      paid_installments: 0,
      frequency: data.frequency,
      start_date: startStr,
      end_date: endStr,
      next_due_date: nextDueStr,
      status: data.status ?? "active",
      notes: data.notes ?? null,
    };
    const { data: ins, error } = await supabase.from("loans").insert(payload).select("id").single();
    if (error) throw new Error(error.message);
    return { id: ins.id };
  });

// ============ DELETE ============
export const deleteLoan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), company_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const role = await getMembershipRole(supabase as never, data.company_id, userId);
    if (!["owner", "admin"].includes(role)) {
      throw new Error("Solo owner e admin possono eliminare finanziamenti");
    }
    const { error } = await supabase.from("loans").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

// ============ RECORD INSTALLMENT ============
// +1 a paid_installments, ricalcola residuo proporzionale, avanza next_due_date di una unità
// secondo la frequency. Quando paid raggiunge total → status='paid_off', residuo=0, next_due_date=null
// (così il prestito esce automaticamente dalle proiezioni future del cash flow).
// Movimento generato: origin='loan' + source_loan_id (anti-duplicato Open Banking).
export const recordLoanInstallment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      loan_id: z.string().uuid(),
      company_id: z.string().uuid(),
      amount: z.number().positive(),
      payment_date: z.string().min(8),
      payment_method: z.string().trim().max(40).optional().nullable(),
      note: z.string().trim().max(300).optional().nullable(),
      create_movement: z.boolean().default(true),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const role = await getMembershipRole(supabase as never, data.company_id, userId);
    if (!["owner", "admin", "accountant"].includes(role)) {
      throw new Error("Permessi insufficienti per registrare rate");
    }

    const { data: loan, error: loanErr } = await supabase
      .from("loans")
      .select("id, name, lender, initial_amount, installment, total_installments, paid_installments, frequency, next_due_date, status")
      .eq("id", data.loan_id)
      .eq("company_id", data.company_id)
      .single();
    if (loanErr) throw new Error(loanErr.message);
    if (!loan) throw new Error("Finanziamento non trovato");
    if (loan.status === "paid_off") throw new Error("Finanziamento già estinto");

    const total = Number(loan.total_installments);
    const previouslyPaid = Number(loan.paid_installments ?? 0);
    const newPaid = Math.min(total, previouslyPaid + 1);
    const reachedEnd = newPaid >= total;

    const initial = Number(loan.initial_amount);
    const newResidual = reachedEnd ? 0 : round2(initial * (1 - newPaid / total));

    let nextDueStr: string | null = null;
    if (!reachedEnd && loan.next_due_date) {
      const freq = (loan.frequency as "monthly" | "quarterly" | "yearly") ?? "monthly";
      nextDueStr = format(advanceDate(parseISO(loan.next_due_date as string), freq), "yyyy-MM-dd");
    }

    const update: {
      paid_installments: number;
      residual: number;
      status: "active" | "paid_off";
      next_due_date: string | null;
    } = {
      paid_installments: newPaid,
      residual: newResidual,
      status: reachedEnd ? "paid_off" : "active",
      next_due_date: nextDueStr,
    };

    const { error: updErr } = await supabase.from("loans").update(update).eq("id", loan.id);
    if (updErr) throw new Error(updErr.message);

    let movement_id: string | null = null;
    if (data.create_movement) {
      const desc = `Rata finanziamento ${loan.name}${loan.lender ? ` (${loan.lender})` : ""}`;
      const { data: tx, error: txErr } = await supabase
        .from("transactions")
        .insert({
          company_id: data.company_id,
          type: "uscita",
          amount: data.amount,
          date: data.payment_date,
          description: data.note ?? desc,
          counterpart: loan.lender,
          payment_method: data.payment_method ?? null,
          status: "confirmed",
          is_forecast: false,
          origin: "loan",
          source_loan_id: loan.id,
          created_by: userId,
        })
        .select("id")
        .single();
      if (txErr) throw new Error(txErr.message);
      movement_id = tx.id as string;
    }

    return {
      loan_id: loan.id,
      paid_installments: newPaid,
      total_installments: total,
      residual: newResidual,
      status: update.status,
      next_due_date: nextDueStr,
      movement_id,
    };
  });
