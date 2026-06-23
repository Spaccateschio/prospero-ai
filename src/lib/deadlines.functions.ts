import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { addMonths, addQuarters, addYears, parseISO, format } from "date-fns";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Allineato all'enum DB public.deadline_kind: tax | contract | payment | admin | other
const KindEnum = z.enum(["tax", "contract", "payment", "admin", "other"]);
const ConfidenceEnum = z.enum(["high", "medium", "low"]);
const RecurrenceEnum = z.enum(["monthly", "quarterly", "yearly"]);
// "overdue" NON è scrivibile: è calcolato a runtime (due_date passata + non saldata).
// Stesso pattern delle fatture.
const WritableStatusEnum = z.enum(["pending", "paid", "cancelled"]);

const UpsertDeadlineSchema = z.object({
  id: z.string().uuid().optional(),
  company_id: z.string().uuid(),
  kind: KindEnum,
  category: z.string().trim().max(60).optional().nullable(),
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(1000).optional().nullable(),
  due_date: z.string().min(8),
  estimated_amount: z.number().nonnegative().optional().nullable(),
  actual_amount: z.number().nonnegative().optional().nullable(),
  confidence: ConfidenceEnum.default("medium"),
  status: WritableStatusEnum.optional(),
  notify_days_before: z.number().int().min(0).max(180).default(7),
  recurrence: RecurrenceEnum.optional().nullable(),
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

function advanceDate(d: Date, recurrence: "monthly" | "quarterly" | "yearly"): Date {
  if (recurrence === "monthly") return addMonths(d, 1);
  if (recurrence === "quarterly") return addQuarters(d, 1);
  return addYears(d, 1);
}

// ============ LIST ============
// effective_status = "overdue" se due_date < oggi e status === "pending".
// Mai persistito (stesso pattern di invoices).
export const listDeadlines = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      company_id: z.string().uuid(),
      kind: KindEnum.optional(),
      kind_not: KindEnum.optional(),
      status: z.enum(["pending", "paid", "overdue", "cancelled"]).optional(),
      from: z.string().optional(),
      to: z.string().optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from("deadlines")
      .select("*")
      .eq("company_id", data.company_id)
      .order("due_date", { ascending: true });
    if (data.kind) q = q.eq("kind", data.kind);
    if (data.kind_not) q = q.neq("kind", data.kind_not);
    if (data.from) q = q.gte("due_date", data.from);
    if (data.to) q = q.lte("due_date", data.to);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const todayStr = new Date().toISOString().slice(0, 10);
    const enriched = (rows ?? []).map((r) => {
      let eff = r.status as "pending" | "paid" | "overdue" | "cancelled";
      if (eff === "pending" && r.due_date < todayStr) eff = "overdue";
      return { ...r, effective_status: eff };
    });
    if (data.status) return enriched.filter((r) => r.effective_status === data.status);
    return enriched;
  });

// ============ UPSERT ============
export const upsertDeadline = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => UpsertDeadlineSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const role = await getMembershipRole(supabase as never, data.company_id, userId);
    if (!["owner", "admin", "accountant"].includes(role)) {
      throw new Error("Permessi insufficienti per modificare le scadenze");
    }

    const payload = {
      company_id: data.company_id,
      kind: data.kind,
      category: data.category ?? null,
      title: data.title,
      description: data.description ?? null,
      due_date: data.due_date,
      estimated_amount: data.estimated_amount ?? null,
      actual_amount: data.actual_amount ?? null,
      confidence: data.confidence,
      status: data.status ?? "pending",
      notify_days_before: data.notify_days_before,
      recurrence: data.recurrence ?? null,
    };

    if (data.id) {
      const { error } = await supabase.from("deadlines").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: ins, error } = await supabase
      .from("deadlines")
      .insert({ ...payload, created_by: userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: ins.id };
  });

// ============ DELETE ============
export const deleteDeadline = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), company_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const role = await getMembershipRole(supabase as never, data.company_id, userId);
    if (!["owner", "admin"].includes(role)) {
      throw new Error("Solo owner e admin possono eliminare scadenze");
    }
    const { error } = await supabase.from("deadlines").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

// ============ MARK PAID ============
// Comportamento ricorrenze (coerente con le rate finanziamenti):
//  - se recurrence != null → la stessa riga avanza: due_date viene spostata
//    alla prossima occorrenza secondo recurrence, status torna "pending",
//    actual_amount/paid_at vengono azzerati. Una sola riga per ricorrenza,
//    storico nei movimenti via origin='deadline' + source_deadline_id.
//    Il forecast proietta in avanti la ricorrenza come per i loan.
//  - se recurrence == null → status='paid', paid_at = ora, fine.
// Movimento generato (opt-in default ON): origin='deadline' + source_deadline_id.
export const markDeadlinePaid = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      deadline_id: z.string().uuid(),
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

    const { data: dl, error: dlErr } = await supabase
      .from("deadlines")
      .select("id, title, kind, category, due_date, recurrence, status")
      .eq("id", data.deadline_id)
      .eq("company_id", data.company_id)
      .single();
    if (dlErr) throw new Error(dlErr.message);
    if (!dl) throw new Error("Scadenza non trovata");
    if (dl.status === "cancelled") throw new Error("Scadenza annullata");

    let update: Record<string, unknown>;
    if (dl.recurrence) {
      const freq = dl.recurrence as "monthly" | "quarterly" | "yearly";
      const nextDue = format(advanceDate(parseISO(dl.due_date as string), freq), "yyyy-MM-dd");
      update = {
        due_date: nextDue,
        status: "pending",
        paid_at: null,
        actual_amount: null,
      };
    } else {
      update = {
        status: "paid",
        paid_at: new Date().toISOString(),
        actual_amount: data.amount,
      };
    }

    const { error: updErr } = await supabase.from("deadlines").update(update).eq("id", dl.id);
    if (updErr) throw new Error(updErr.message);

    let movement_id: string | null = null;
    if (data.create_movement) {
      const desc = data.note ?? `Scadenza ${dl.title}${dl.category ? ` (${dl.category})` : ""}`;
      const { data: tx, error: txErr } = await supabase
        .from("transactions")
        .insert({
          company_id: data.company_id,
          type: "uscita",
          amount: data.amount,
          date: data.payment_date,
          description: desc,
          category: dl.category ?? null,
          payment_method: data.payment_method ?? null,
          status: "confirmed",
          is_forecast: false,
          origin: "deadline",
          source_deadline_id: dl.id,
          created_by: userId,
        })
        .select("id")
        .single();
      if (txErr) throw new Error(txErr.message);
      movement_id = tx.id as string;
    }

    return {
      deadline_id: dl.id,
      recurred: !!dl.recurrence,
      next_due_date: dl.recurrence ? (update.due_date as string) : null,
      movement_id,
    };
  });
