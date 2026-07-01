import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Anagrafica Clienti/Fornitori: unisce due fonti
 * 1) le controparti derivate dalle fatture (invoices) - statistiche automatiche
 * 2) i record importati/creati manualmente nella tabella clients (anagrafica pura,
 *    utile per censire un cliente/fornitore anche prima di avere documenti)
 */

export type CounterpartRow = {
  key: string;
  client_id: string | null;
  name: string;
  vat: string | null;
  fiscal_code: string | null;
  email: string | null;
  phone: string | null;
  zone: string | null;
  category: string | null;
  notes: string | null;
  type: "cliente" | "fornitore";
  documents_count: number;
  total_amount: number;
  paid_amount: number;
  open_balance: number;
  overdue_amount: number;
  last_document_date: string | null;
};

function makeKey(type: string, vat: string | null | undefined, name: string) {
  return `${type}::${(vat || "").trim().toLowerCase()}::${name.trim().toLowerCase()}`;
}

export const listCounterparts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      company_id: z.string().uuid(),
      type: z.enum(["cliente", "fornitore", "all"]).default("all"),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("invoices")
      .select("direction, number, counterpart_name, counterpart_vat, total_amount, paid_amount, status, issue_date, due_date")
      .eq("company_id", data.company_id);
    if (error) throw new Error(error.message);

    const todayStr = new Date().toISOString().slice(0, 10);
    const map = new Map<string, CounterpartRow>();

    for (const r of rows ?? []) {
      const type: "cliente" | "fornitore" = r.direction === "attiva" ? "cliente" : "fornitore";
      if (data.type !== "all" && data.type !== type) continue;

      const key = makeKey(type, r.counterpart_vat, r.counterpart_name);
      const total = Number(r.total_amount || 0);
      const paid = Number(r.paid_amount || 0);
      const isCancelled = r.status === "cancelled";
      const openAmt = isCancelled ? 0 : Math.max(0, total - paid);
      const isOverdue = !isCancelled && openAmt > 0 && r.due_date && r.due_date < todayStr;

      const existing = map.get(key);
      if (existing) {
        existing.documents_count += 1;
        existing.total_amount += total;
        existing.paid_amount += paid;
        existing.open_balance += openAmt;
        existing.overdue_amount += isOverdue ? openAmt : 0;
        if (r.issue_date && (!existing.last_document_date || r.issue_date > existing.last_document_date)) {
          existing.last_document_date = r.issue_date;
        }
      } else {
        map.set(key, {
          key,
          client_id: null,
          name: r.counterpart_name,
          vat: r.counterpart_vat,
          fiscal_code: null,
          email: null,
          phone: null,
          zone: null,
          category: null,
          notes: null,
          type,
          documents_count: 1,
          total_amount: total,
          paid_amount: paid,
          open_balance: openAmt,
          overdue_amount: isOverdue ? openAmt : 0,
          last_document_date: r.issue_date,
        });
      }
    }

    // Unisce l'anagrafica pura (tabella clients): arricchisce i record già presenti
    // con email/telefono/note, e aggiunge quelli senza ancora documenti.
    const { data: clientRows, error: clientErr } = await supabase
      .from("clients")
      .select("id, name, vat, fiscal_code, email, phone, zone, category, notes, type")
      .eq("company_id", data.company_id);
    if (clientErr) throw new Error(clientErr.message);

    for (const c of clientRows ?? []) {
      const types: Array<"cliente" | "fornitore"> = c.type === "entrambi" ? ["cliente", "fornitore"] : [c.type as "cliente" | "fornitore"];
      for (const type of types) {
        if (data.type !== "all" && data.type !== type) continue;
        const key = makeKey(type, c.vat, c.name);
        const existing = map.get(key);
        if (existing) {
          existing.client_id = c.id;
          existing.fiscal_code = c.fiscal_code;
          existing.email = c.email;
          existing.phone = c.phone;
          existing.zone = c.zone;
          existing.category = c.category;
          existing.notes = c.notes;
        } else {
          map.set(key, {
            key,
            client_id: c.id,
            name: c.name,
            vat: c.vat,
            fiscal_code: c.fiscal_code,
            email: c.email,
            phone: c.phone,
            zone: c.zone,
            category: c.category,
            notes: c.notes,
            type,
            documents_count: 0,
            total_amount: 0,
            paid_amount: 0,
            open_balance: 0,
            overdue_amount: 0,
            last_document_date: null,
          });
        }
      }
    }

    return Array.from(map.values()).sort((a, b) => b.total_amount - a.total_amount);
  });

// ============ IMPORT (upsert batch da Excel) ============
const ImportRowSchema = z.object({
  name: z.string().trim().min(1).max(200),
  type: z.enum(["cliente", "fornitore", "entrambi"]).default("cliente"),
  vat: z.string().trim().max(40).optional().nullable(),
  fiscal_code: z.string().trim().max(40).optional().nullable(),
  email: z.string().trim().max(200).optional().nullable(),
  phone: z.string().trim().max(60).optional().nullable(),
  zone: z.string().trim().max(120).optional().nullable(),
  category: z.string().trim().max(120).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
});

export const importCounterparts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      company_id: z.string().uuid(),
      rows: z.array(ImportRowSchema).min(1).max(2000),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: membership, error: roleErr } = await supabase
      .from("company_users")
      .select("role")
      .eq("company_id", data.company_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (roleErr) throw new Error(roleErr.message);
    if (!membership || !["owner", "admin", "accountant"].includes(membership.role)) {
      throw new Error("Permessi insufficienti per importare l'anagrafica");
    }

    const withVat = data.rows.filter((r) => r.vat && r.vat.trim());
    const withoutVat = data.rows.filter((r) => !r.vat || !r.vat.trim());

    let upserted = 0;
    if (withVat.length > 0) {
      const payload = withVat.map((r) => ({
        company_id: data.company_id,
        name: r.name,
        type: r.type,
        vat: r.vat,
        fiscal_code: r.fiscal_code ?? null,
        email: r.email ?? null,
        phone: r.phone ?? null,
        zone: r.zone ?? null,
        category: r.category ?? null,
        notes: r.notes ?? null,
      }));
      const { data: ins, error } = await supabase
        .from("clients")
        .upsert(payload, { onConflict: "company_id,type,vat" })
        .select("id");
      if (error) throw new Error(error.message);
      upserted += ins?.length ?? 0;
    }
    if (withoutVat.length > 0) {
      const payload = withoutVat.map((r) => ({
        company_id: data.company_id,
        name: r.name,
        type: r.type,
        vat: null,
        fiscal_code: r.fiscal_code ?? null,
        email: r.email ?? null,
        phone: r.phone ?? null,
        zone: r.zone ?? null,
        category: r.category ?? null,
        notes: r.notes ?? null,
      }));
      const { data: ins, error } = await supabase.from("clients").insert(payload).select("id");
      if (error) throw new Error(error.message);
      upserted += ins?.length ?? 0;
    }

    return { upserted, total: data.rows.length };
  });
