import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const DirectionEnum = z.enum(["attiva", "passiva"]);
// We deliberately do NOT accept "overdue" as a writable status. Overdue is
// computed dynamically (due_date passed + not paid) and never persisted by us.
const WritableStatusEnum = z.enum(["draft", "sent", "partially_paid", "paid", "cancelled"]);

const UpsertInvoiceSchema = z.object({
  id: z.string().uuid().optional(),
  company_id: z.string().uuid(),
  direction: DirectionEnum,
  number: z.string().trim().max(60).optional().nullable(),
  counterpart_name: z.string().trim().min(1).max(160),
  counterpart_vat: z.string().trim().max(20).optional().nullable(),
  amount: z.number().nonnegative(),
  vat_amount: z.number().nonnegative().optional().nullable(),
  total_amount: z.number().positive(),
  issue_date: z.string().optional().nullable(),
  due_date: z.string().optional().nullable(),
  status: WritableStatusEnum.optional(),
  payment_method: z.string().trim().max(40).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
  notes_internal: z.string().trim().max(1000).optional().nullable(),
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

// ============ LIST ============
export const listInvoices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      company_id: z.string().uuid(),
      direction: DirectionEnum.optional(),
      status: z.enum(["draft", "sent", "partially_paid", "paid", "overdue", "cancelled"]).optional(),
      from: z.string().optional(),
      to: z.string().optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from("invoices")
      .select("*")
      .eq("company_id", data.company_id)
      .order("issue_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });
    if (data.direction) q = q.eq("direction", data.direction);
    if (data.from) q = q.gte("issue_date", data.from);
    if (data.to) q = q.lte("issue_date", data.to);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    // Apply optional status filter AFTER computing effective overdue
    const todayStr = new Date().toISOString().slice(0, 10);
    const enriched = (rows ?? []).map((r) => {
      const total = Number(r.total_amount);
      const paid = Number(r.paid_amount ?? 0);
      const persisted = r.status as string;
      const isOpen = persisted !== "paid" && persisted !== "cancelled" && persisted !== "draft" && paid < total;
      const effective_status =
        isOpen && r.due_date && (r.due_date as string) < todayStr ? "overdue" : persisted;
      return { ...r, effective_status, paid_amount: paid };
    });
    if (data.status) return enriched.filter((r) => r.effective_status === data.status);
    return enriched;
  });

// ============ UPSERT ============
export const upsertInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => UpsertInvoiceSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const role = await getMembershipRole(supabase as never, data.company_id, userId);
    if (!["owner", "admin", "accountant"].includes(role)) {
      throw new Error("Permessi insufficienti per modificare le fatture");
    }
    const payload = {
      company_id: data.company_id,
      direction: data.direction,
      number: data.number ?? null,
      counterpart_name: data.counterpart_name,
      counterpart_vat: data.counterpart_vat ?? null,
      amount: data.amount,
      vat_amount: data.vat_amount ?? null,
      total_amount: data.total_amount,
      issue_date: data.issue_date || null,
      due_date: data.due_date || null,
      status: data.status ?? "sent",
      payment_method: data.payment_method ?? null,
      notes: data.notes ?? null,
      notes_internal: data.notes_internal ?? null,
    };
    if (data.id) {
      const { error } = await supabase.from("invoices").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: ins, error } = await supabase
      .from("invoices")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: ins.id };
  });

// ============ DELETE ============
export const deleteInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), company_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const role = await getMembershipRole(supabase as never, data.company_id, userId);
    if (!["owner", "admin"].includes(role)) {
      throw new Error("Solo owner e admin possono eliminare fatture");
    }
    const { error } = await supabase.from("invoices").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

// ============ RECORD PAYMENT ============
// Increments paid_amount by `amount`. If reaches total → status='paid' + paid_date.
// Else if > 0 → status='partially_paid'. Overdue is never written (computed dynamically).
// If create_movement=true, creates a linked transaction with origin='invoice' + source_invoice_id.
export const recordInvoicePayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      invoice_id: z.string().uuid(),
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
      throw new Error("Permessi insufficienti per registrare pagamenti");
    }

    const { data: inv, error: invErr } = await supabase
      .from("invoices")
      .select("id, direction, total_amount, paid_amount, counterpart_name, number, status")
      .eq("id", data.invoice_id)
      .eq("company_id", data.company_id)
      .single();
    if (invErr) throw new Error(invErr.message);
    if (!inv) throw new Error("Fattura non trovata");

    const total = Number(inv.total_amount);
    const previouslyPaid = Number(inv.paid_amount ?? 0);
    const newPaid = Math.min(total, previouslyPaid + data.amount);
    const reachedFull = newPaid >= total - 0.005;

    const update: Record<string, unknown> = {
      paid_amount: newPaid,
      status: reachedFull ? "paid" : "partially_paid",
    };
    if (reachedFull) update.paid_date = data.payment_date;
    if (data.payment_method) update.payment_method = data.payment_method;

    const { error: updErr } = await supabase
      .from("invoices")
      .update(update)
      .eq("id", inv.id);
    if (updErr) throw new Error(updErr.message);

    let movement_id: string | null = null;
    if (data.create_movement) {
      const isIncoming = inv.direction === "attiva";
      const desc = `Pagamento fattura ${inv.number ?? ""}`.trim();
      const { data: tx, error: txErr } = await supabase
        .from("transactions")
        .insert({
          company_id: data.company_id,
          type: isIncoming ? "entrata" : "uscita",
          amount: data.amount,
          date: data.payment_date,
          description: data.note ?? desc,
          counterpart: inv.counterpart_name,
          payment_method: data.payment_method ?? null,
          status: "confirmed",
          is_forecast: false,
          origin: "invoice",
          source_invoice_id: inv.id,
          created_by: userId,
        })
        .select("id")
        .single();
      if (txErr) throw new Error(txErr.message);
      movement_id = tx.id as string;
    }

    return {
      invoice_id: inv.id,
      new_paid_amount: newPaid,
      status: update.status as string,
      movement_id,
    };
  });
