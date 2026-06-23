import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Campi anagrafici dell'azienda che possono provenire da verifica esterna.
 * Mantenuti allineati con la tabella `companies` + colonne aggiunte.
 */
const ANAGRAFICA_FIELDS = [
  "name", "legal_name", "legal_form", "vat", "fiscal_code",
  "ateco", "ateco_description", "sector",
  "pec_email", "sdi_code", "rea_code", "chamber_of_commerce",
  "activity_status", "activity_start_date",
  "legal_address_street", "city", "province", "region", "zip_code",
  "company_type",
] as const;

type AnagraficaField = (typeof ANAGRAFICA_FIELDS)[number];

const FieldSourceSchema = z.enum(["user", "external", "document"]);

const PayloadSchema = z.object({
  company_id: z.string().uuid(),
  values: z
    .object({
      name: z.string().trim().min(2).max(160).optional(),
      legal_name: z.string().trim().max(160).optional().nullable(),
      legal_form: z.string().trim().max(80).optional().nullable(),
      vat: z.string().trim().max(20).optional().nullable(),
      fiscal_code: z.string().trim().max(20).optional().nullable(),
      ateco: z.string().trim().max(10).optional().nullable(),
      ateco_description: z.string().trim().max(300).optional().nullable(),
      sector: z.string().trim().max(80).optional().nullable(),
      pec_email: z.string().trim().email().max(160).optional().nullable().or(z.literal("")),
      sdi_code: z.string().trim().max(20).optional().nullable(),
      rea_code: z.string().trim().max(40).optional().nullable(),
      chamber_of_commerce: z.string().trim().max(80).optional().nullable(),
      activity_status: z.string().trim().max(40).optional().nullable(),
      activity_start_date: z.string().trim().optional().nullable(),
      legal_address_street: z.string().trim().max(200).optional().nullable(),
      city: z.string().trim().max(80).optional().nullable(),
      province: z.string().trim().max(60).optional().nullable(),
      region: z.string().trim().max(60).optional().nullable(),
      zip_code: z.string().trim().max(10).optional().nullable(),
      company_type: z
        .enum(["srl", "srls", "spa", "sapa", "snc", "sas", "ditta_individuale", "cooperativa", "altro"])
        .optional()
        .nullable(),
    })
    .partial(),
  sources: z.record(z.string(), FieldSourceSchema).optional(),
  provider: z.string().optional(),
  mark_verified: z.boolean().optional(),
});

export const saveCompanyAnagrafica = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => PayloadSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Verifica membership (RLS proteggerà ulteriormente)
    const { data: membership, error: memErr } = await supabase
      .from("company_users")
      .select("role")
      .eq("company_id", data.company_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (memErr) throw new Error(memErr.message);
    if (!membership) throw new Error("Non sei membro di questa azienda");
    if (!["owner", "admin"].includes(membership.role)) {
      throw new Error("Solo owner e admin possono modificare l'anagrafica");
    }

    // Pulisci valori vuoti string → null
    const cleanValues: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data.values)) {
      if (v === "" || v === undefined) {
        cleanValues[k] = null;
      } else {
        cleanValues[k] = v;
      }
    }

    const hasExternal = Object.values(data.sources ?? {}).some((s) => s === "external");

    // Update companies
    const updatePayload: Record<string, unknown> = {
      ...cleanValues,
      data_source: hasExternal ? "mixed" : "manual",
    };
    if (data.mark_verified) {
      updatePayload.last_verified_at = new Date().toISOString();
      updatePayload.verification_provider = data.provider ?? null;
    }

    const { error: updateErr } = await supabase
      .from("companies")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update(updatePayload as any)
      .eq("id", data.company_id);
    if (updateErr) throw new Error(updateErr.message);

    // Upsert field sources
    const sources = data.sources ?? {};
    const rows = Object.entries(sources)
      .filter(([field]) => (ANAGRAFICA_FIELDS as readonly string[]).includes(field))
      .map(([field, source]) => ({
        company_id: data.company_id,
        field_name: field as AnagraficaField,
        source,
        provider: source === "external" ? data.provider ?? null : null,
        verified_at: new Date().toISOString(),
        updated_by: userId,
      }));

    if (rows.length > 0) {
      const { error: srcErr } = await supabase
        .from("company_field_sources")
        .upsert(rows, { onConflict: "company_id,field_name" });
      if (srcErr) throw new Error(srcErr.message);
    }

    return { ok: true as const };
  });

export const getCompanyAnagrafica = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ company_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const [{ data: company, error: cErr }, { data: sources, error: sErr }] = await Promise.all([
      supabase.from("companies").select("*").eq("id", data.company_id).single(),
      supabase.from("company_field_sources").select("field_name, source, provider, verified_at").eq("company_id", data.company_id),
    ]);
    if (cErr) throw new Error(cErr.message);
    if (sErr) throw new Error(sErr.message);

    const sourceMap: Record<string, { source: string; provider: string | null; verified_at: string }> = {};
    for (const s of sources ?? []) {
      sourceMap[s.field_name] = {
        source: s.source,
        provider: s.provider,
        verified_at: s.verified_at,
      };
    }

    return { company, sources: sourceMap };
  });
