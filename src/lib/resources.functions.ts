import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const KindEnum = z.enum(["banca", "cassa_contanti", "cassa_assegni", "altro"]);

async function getMembershipRole(
  supabase: {
    from: (t: string) => {
      select: (s: string) => {
        eq: (c: string, v: string) => {
          eq: (c: string, v: string) => {
            maybeSingle: () => Promise<{ data: { role: string } | null; error: { message: string } | null }>;
          };
        };
      };
    };
  },
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

export type FinancialResourceRow = {
  id: string;
  name: string;
  kind: "banca" | "cassa_contanti" | "cassa_assegni" | "altro";
  opening_balance: number;
  opening_balance_date: string;
  color: string | null;
  position: number;
  is_active: boolean;
  notes: string | null;
  current_balance: number;
};

// ============ LIST (con saldo corrente calcolato) ============
export const listFinancialResources = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ company_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: resources, error: resErr } = await supabase
      .from("financial_resources")
      .select("*")
      .eq("company_id", data.company_id)
      .order("position", { ascending: true });
    if (resErr) throw new Error(resErr.message);
    if (!resources || resources.length === 0) return [];

    const { data: movements, error: movErr } = await supabase
      .from("transactions")
      .select("resource_id, type, amount, status")
      .eq("company_id", data.company_id)
      .in("resource_id", resources.map((r) => r.id))
      .neq("status", "pending");
    if (movErr) throw new Error(movErr.message);

    const deltas = new Map<string, number>();
    for (const m of movements ?? []) {
      if (!m.resource_id) continue;
      const sign = m.type === "entrata" ? 1 : -1;
      deltas.set(m.resource_id, (deltas.get(m.resource_id) ?? 0) + sign * Number(m.amount));
    }

    return (resources as Array<Omit<FinancialResourceRow, "current_balance">>).map((r) => ({
      ...r,
      current_balance: Number(r.opening_balance) + (deltas.get(r.id) ?? 0),
    })) as FinancialResourceRow[];
  });

// ============ UPSERT ============
export const upsertFinancialResource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      id: z.string().uuid().optional(),
      company_id: z.string().uuid(),
      name: z.string().trim().min(1).max(100),
      kind: KindEnum,
      opening_balance: z.number(),
      opening_balance_date: z.string().min(8),
      color: z.string().trim().max(20).optional().nullable(),
      position: z.number().int().optional(),
      is_active: z.boolean().optional(),
      notes: z.string().trim().max(500).optional().nullable(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const role = await getMembershipRole(supabase as never, data.company_id, userId);
    if (!["owner", "admin", "accountant"].includes(role)) {
      throw new Error("Permessi insufficienti per gestire le risorse finanziarie");
    }
    const payload = {
      company_id: data.company_id,
      name: data.name,
      kind: data.kind,
      opening_balance: data.opening_balance,
      opening_balance_date: data.opening_balance_date,
      color: data.color ?? null,
      position: data.position ?? 0,
      is_active: data.is_active ?? true,
      notes: data.notes ?? null,
    };
    if (data.id) {
      const { error } = await supabase.from("financial_resources").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: ins, error } = await supabase
      .from("financial_resources")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: ins.id };
  });

// ============ DELETE ============
export const deleteFinancialResource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), company_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const role = await getMembershipRole(supabase as never, data.company_id, userId);
    if (!["owner", "admin"].includes(role)) {
      throw new Error("Solo owner e admin possono eliminare risorse finanziarie");
    }
    const { error } = await supabase.from("financial_resources").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
