import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Anagrafica Clienti/Fornitori derivata dalle fatture (invoices).
 * Non serve una tabella separata: raggruppiamo per controparte
 * (nome + P.IVA) e direzione (attiva = cliente, passiva = fornitore).
 */

export type CounterpartRow = {
  key: string;
  name: string;
  vat: string | null;
  type: "cliente" | "fornitore";
  documents_count: number;
  total_amount: number;
  paid_amount: number;
  open_balance: number;
  overdue_amount: number;
  last_document_date: string | null;
};

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

      const key = `${type}::${(r.counterpart_vat || "").trim().toLowerCase()}::${r.counterpart_name.trim().toLowerCase()}`;
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
          name: r.counterpart_name,
          vat: r.counterpart_vat,
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

    return Array.from(map.values()).sort((a, b) => b.total_amount - a.total_amount);
  });
