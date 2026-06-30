import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// =============================================================
// Tipi
// =============================================================

export type ExtractedInvoice = {
  document_type: "fattura" | "parcella" | "nota_credito" | "ricevuta" | "ddt";
  direction: "attiva" | "passiva";
  number: string | null;
  counterpart_name: string;
  counterpart_vat: string | null;
  issue_date: string | null; // YYYY-MM-DD
  due_date: string | null;
  amount: number | null; // imponibile
  vat_amount: number | null;
  total_amount: number; // totale documento
};

export type ExtractedF24 = {
  payment_date: string;
  total_amount: number;
  protocol: string | null;
  sections: Array<{
    sezione: string | null;
    codice_tributo: string | null;
    periodo: string | null;
    importo_debito: number | null;
    importo_credito: number | null;
  }>;
};

export type ExtractionResult =
  | {
      status: "success";
      invoices: ExtractedInvoice[];
      tax_payments: ExtractedF24[];
      summary: string;
    }
  | { status: "error"; message: string };

// =============================================================
// Helpers di parsing
// =============================================================

const num = (v: unknown): number | null => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const cleaned = v
      .replace(/[€$]/g, "")
      .replace(/\s/g, "")
      .replace(/\.(?=\d{3}(\D|$))/g, "")
      .replace(",", ".")
      .replace(/[^\d.-]/g, "");
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

const str = (v: unknown): string | null => {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 && t.toLowerCase() !== "null" ? t : null;
};

const normalizeDate = (s: unknown): string | null => {
  const v = str(s);
  if (!v) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const m1 = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m1) return `${m1[3]}-${m1[2]}-${m1[1]}`;
  const m2 = v.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (m2) return `${m2[3]}-${m2[2]}-${m2[1]}`;
  return null;
};

const docType = (v: unknown): ExtractedInvoice["document_type"] => {
  const t = (str(v) ?? "fattura").toLowerCase();
  if (t.includes("parcella")) return "parcella";
  if (t.includes("nota") && t.includes("credit")) return "nota_credito";
  if (t.includes("ricevuta")) return "ricevuta";
  if (t.includes("ddt") || t.includes("trasporto")) return "ddt";
  return "fattura";
};

const direction = (
  v: unknown,
  fallback: "attiva" | "passiva",
): "attiva" | "passiva" => {
  const t = (str(v) ?? "").toLowerCase();
  if (t.startsWith("att") || t.includes("emess") || t.includes("vendit") || t === "sales") return "attiva";
  if (t.startsWith("pas") || t.includes("ricev") || t.includes("acquist") || t === "purchases") return "passiva";
  return fallback;
};

// =============================================================
// EXTRACT: scansiona un PDF e ritorna documenti riconosciuti
// =============================================================

const ExtractSchema = z.object({
  pdf_base64: z.string().min(100).max(14_000_000),
  filename: z.string().max(200).optional(),
  hint_direction: z.enum(["attiva", "passiva"]).optional(),
});

export const extractDocumentsFromPdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ExtractSchema.parse(input))
  .handler(async ({ data, context }): Promise<ExtractionResult> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) return { status: "error", message: "Servizio AI non configurato." };

    // Quota modalità prova
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("is_demo, ai_extractions_used")
      .eq("id", context.userId)
      .maybeSingle();
    if (profile?.is_demo && (profile.ai_extractions_used ?? 0) >= 1) {
      return {
        status: "error",
        message:
          "Hai usato l'estrazione AI gratuita della modalità prova. Registrati per continuare.",
      };
    }

    const hint = data.hint_direction
      ? `\n\nINDICAZIONE UTENTE: i documenti contenuti sono molto probabilmente ${
          data.hint_direction === "attiva" ? "FATTURE EMESSE (ATTIVE)" : "FATTURE RICEVUTE (PASSIVE)"
        }. Usa questa direzione come default quando non è esplicitamente indicata.`
      : "";

    const systemPrompt = `Sei un estrattore di documenti contabili italiani. Ricevi un PDF che può contenere:
- una o più FATTURE (singole) attive o passive
- un ELENCO TABELLARE di fatture emesse o ricevute
- PARCELLE professionali
- NOTE DI CREDITO
- RICEVUTE FISCALI
- DDT (documenti di trasporto)
- F24 (modello pagamento imposte)

Restituisci SOLO un oggetto JSON valido con questo schema:
{
  "invoices": [
    {
      "document_type": "fattura" | "parcella" | "nota_credito" | "ricevuta" | "ddt",
      "direction": "attiva" | "passiva",
      "number": "string|null",
      "counterpart_name": "string",
      "counterpart_vat": "string|null",
      "issue_date": "YYYY-MM-DD|null",
      "due_date": "YYYY-MM-DD|null",
      "amount": number|null,        // imponibile
      "vat_amount": number|null,    // IVA
      "total_amount": number         // totale documento (IVA inclusa)
    }
  ],
  "tax_payments": [
    {
      "payment_date": "YYYY-MM-DD",
      "total_amount": number,
      "protocol": "string|null",
      "sections": [
        {
          "sezione": "ERARIO|INPS|REGIONI|IMU|ALTRI|null",
          "codice_tributo": "string|null",
          "periodo": "string|null",
          "importo_debito": number|null,
          "importo_credito": number|null
        }
      ]
    }
  ],
  "summary": "Breve descrizione di cosa hai trovato (es: '47 fatture emesse nel periodo gen-mar 2026')"
}

REGOLE:
- Importi numerici (point decimal, niente separatori migliaia o simbolo €). I valori a debito/credito sempre positivi.
- Date sempre in YYYY-MM-DD.
- Se il PDF è un ELENCO tabellare con sole righe (Num, Data, Nominativo, Totale), considera "counterpart_name" = colonna Nominativo, "number" = colonna Num, "issue_date" = colonna Data, "total_amount" = colonna Totale; "amount" e "vat_amount" possono essere null.
- Se "Tipo documento" è esplicito ("Fattura", "Parcella", "Nota di credito"...), mappalo su document_type.
- Se la direction non è deducibile, usa il fallback indicato dall'utente.
- Non inventare valori. Restituisci array vuoti se una categoria non è presente.${hint}`;

    try {
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Estrai tutti i documenti dal PDF allegato secondo lo schema JSON indicato.",
                },
                {
                  type: "file",
                  file: {
                    filename: data.filename ?? "documento.pdf",
                    file_data: `data:application/pdf;base64,${data.pdf_base64}`,
                  },
                },
              ],
            },
          ],
          response_format: { type: "json_object" },
        }),
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        if (response.status === 429)
          return { status: "error", message: "Troppe richieste, riprova tra qualche secondo." };
        if (response.status === 402)
          return {
            status: "error",
            message: "Crediti AI esauriti. Aggiungili da Settings → Plans & credits.",
          };
        console.error("[extractDocumentsFromPdf] AI gateway error", response.status, errText);
        return { status: "error", message: `Errore estrazione (HTTP ${response.status}).` };
      }

      const json = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = json.choices?.[0]?.message?.content;
      if (!content) return { status: "error", message: "Risposta AI vuota." };

      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(content);
      } catch {
        const match = content.match(/\{[\s\S]*\}/);
        if (!match) return { status: "error", message: "Formato risposta AI non valido." };
        parsed = JSON.parse(match[0]);
      }

      const fallbackDir = data.hint_direction ?? "attiva";

      const invoices: ExtractedInvoice[] = Array.isArray(parsed.invoices)
        ? (parsed.invoices as unknown[]).map((raw) => {
            const o = (raw ?? {}) as Record<string, unknown>;
            const total = num(o.total_amount) ?? num(o.amount) ?? 0;
            return {
              document_type: docType(o.document_type),
              direction: direction(o.direction, fallbackDir),
              number: str(o.number),
              counterpart_name: str(o.counterpart_name) ?? "—",
              counterpart_vat: str(o.counterpart_vat),
              issue_date: normalizeDate(o.issue_date),
              due_date: normalizeDate(o.due_date),
              amount: num(o.amount),
              vat_amount: num(o.vat_amount),
              total_amount: Number(total),
            };
          })
        : [];

      const taxPayments: ExtractedF24[] = Array.isArray(parsed.tax_payments)
        ? (parsed.tax_payments as unknown[]).map((raw) => {
            const o = (raw ?? {}) as Record<string, unknown>;
            return {
              payment_date: normalizeDate(o.payment_date) ?? new Date().toISOString().slice(0, 10),
              total_amount: num(o.total_amount) ?? 0,
              protocol: str(o.protocol),
              sections: Array.isArray(o.sections)
                ? (o.sections as unknown[]).map((s) => {
                    const x = (s ?? {}) as Record<string, unknown>;
                    return {
                      sezione: str(x.sezione),
                      codice_tributo: str(x.codice_tributo),
                      periodo: str(x.periodo),
                      importo_debito: num(x.importo_debito),
                      importo_credito: num(x.importo_credito),
                    };
                  })
                : [],
            };
          })
        : [];

      if (invoices.length === 0 && taxPayments.length === 0) {
        return {
          status: "error",
          message: "Nessun documento riconosciuto nel PDF.",
        };
      }

      if (profile?.is_demo) {
        await context.supabase.rpc("increment_ai_extractions");
      }

      return {
        status: "success",
        invoices,
        tax_payments: taxPayments,
        summary: str(parsed.summary) ?? `${invoices.length} documenti, ${taxPayments.length} F24`,
      };
    } catch (err) {
      console.error("[extractDocumentsFromPdf] failed", err);
      return {
        status: "error",
        message: err instanceof Error ? err.message : "Errore imprevisto durante l'estrazione.",
      };
    }
  });

// =============================================================
// BULK SAVE: salva un array di documenti confermati dall'utente
// =============================================================

const BulkSaveSchema = z.object({
  company_id: z.string().uuid(),
  items: z
    .array(
      z.object({
        document_type: z.enum(["fattura", "parcella", "nota_credito", "ricevuta", "ddt"]),
        direction: z.enum(["attiva", "passiva"]),
        number: z.string().trim().max(60).nullable(),
        counterpart_name: z.string().trim().min(1).max(160),
        counterpart_vat: z.string().trim().max(20).nullable(),
        issue_date: z.string().nullable(),
        due_date: z.string().nullable(),
        amount: z.number().nullable(),
        vat_amount: z.number().nullable(),
        total_amount: z.number().nonnegative(),
      }),
    )
    .min(1)
    .max(1000),
});

export const bulkSaveInvoices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => BulkSaveSchema.parse(input))
  .handler(async ({ data, context }) => {
    const rows = data.items.map((it) => ({
      company_id: data.company_id,
      document_type: it.document_type,
      direction: it.direction,
      number: it.number,
      counterpart_name: it.counterpart_name,
      counterpart_vat: it.counterpart_vat,
      amount: it.amount ?? it.total_amount,
      vat_amount: it.vat_amount,
      total_amount: it.total_amount,
      issue_date: it.issue_date,
      due_date: it.due_date,
      status: "sent" as const,
    }));
    const { error, data: inserted } = await context.supabase
      .from("invoices")
      .insert(rows)
      .select("id");
    if (error) {
      console.error("[bulkSaveInvoices] failed", error);
      throw new Error(error.message);
    }
    return { inserted: inserted?.length ?? 0 };
  });

// =============================================================
// TAX PAYMENTS (F24) CRUD
// =============================================================

const SaveTaxSchema = z.object({
  company_id: z.string().uuid(),
  payment_date: z.string().min(8),
  total_amount: z.number().nonnegative(),
  protocol: z.string().trim().max(60).nullable().optional(),
  sections: z
    .array(
      z.object({
        sezione: z.string().nullable(),
        codice_tributo: z.string().nullable(),
        periodo: z.string().nullable(),
        importo_debito: z.number().nullable(),
        importo_credito: z.number().nullable(),
      }),
    )
    .default([]),
  notes: z.string().max(500).nullable().optional(),
});

export const saveTaxPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SaveTaxSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { error, data: row } = await context.supabase
      .from("tax_payments")
      .insert({
        company_id: data.company_id,
        payment_date: data.payment_date,
        total_amount: data.total_amount,
        protocol: data.protocol ?? null,
        sections: data.sections,
        notes: data.notes ?? null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const listTaxPayments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ company_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("tax_payments")
      .select("*")
      .eq("company_id", data.company_id)
      .order("payment_date", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const deleteTaxPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), company_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("tax_payments")
      .delete()
      .eq("id", data.id)
      .eq("company_id", data.company_id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
