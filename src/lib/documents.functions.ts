import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// =============================================================
// Tipi pubblici
// =============================================================

export type ExtractedInvoice = {
  document_type: "fattura" | "parcella" | "nota_credito" | "ricevuta" | "ddt";
  direction: "attiva" | "passiva";
  number: string | null;
  counterpart_name: string;
  counterpart_vat: string | null;
  issue_date: string | null;
  due_date: string | null;
  amount: number | null;
  vat_amount: number | null;
  total_amount: number;
};

// =============================================================
// Parsing helpers
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
  const m1 = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m1) return `${m1[3]}-${m1[2].padStart(2, "0")}-${m1[1].padStart(2, "0")}`;
  const m2 = v.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (m2) return `${m2[3]}-${m2[2].padStart(2, "0")}-${m2[1].padStart(2, "0")}`;
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
// IMPORT JOBS — flusso a chunk
// =============================================================

const StartJobSchema = z.object({
  company_id: z.string().uuid(),
  filename: z.string().max(200).nullable().optional(),
  hint_direction: z.enum(["attiva", "passiva"]).nullable().optional(),
  total_chunks: z.number().int().min(1).max(2000),
});

export const startImportJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => StartJobSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("import_jobs")
      .insert({
        company_id: data.company_id,
        created_by: context.userId,
        filename: data.filename ?? null,
        hint_direction: data.hint_direction ?? null,
        total_chunks: data.total_chunks,
        status: "processing",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { job_id: row.id as string };
  });

const GetJobSchema = z.object({ job_id: z.string().uuid() });

export const getImportJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => GetJobSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("import_jobs")
      .select("*")
      .eq("id", data.job_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row;
  });

export const cancelImportJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => GetJobSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("import_jobs")
      .update({ status: "cancelled" })
      .eq("id", data.job_id)
      .in("status", ["pending", "processing"]);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

const ChunkSchema = z.object({
  job_id: z.string().uuid(),
  chunk_index: z.number().int().min(0),
  text: z.string().min(1).max(80_000),
});

const InvoiceInputSchema = z.object({
  document_type: z.enum(["fattura", "parcella", "nota_credito", "ricevuta", "ddt"]),
  direction: z.enum(["attiva", "passiva"]),
  number: z.string().max(60).nullable(),
  counterpart_name: z.string().min(1).max(200),
  counterpart_vat: z.string().max(40).nullable(),
  issue_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  amount: z.number().nullable(),
  vat_amount: z.number().nullable(),
  total_amount: z.number().positive(),
  paid_amount: z.number().min(0).nullable().optional(),
});

const BatchSchema = z.object({
  job_id: z.string().uuid(),
  chunks_processed: z.number().int().min(1).default(1),
  invoices: z.array(InvoiceInputSchema).max(500),
});

type ChunkResult = {
  status: "ok" | "failed" | "skipped";
  inserted: number;
  parsed: number;
  message?: string;
};

export const processInvoicesBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => BatchSchema.parse(input))
  .handler(async ({ data, context }): Promise<ChunkResult> => {
    const supabase = context.supabase;
    const { data: job } = await supabase
      .from("import_jobs")
      .select("id, company_id, status, processed_chunks, inserted_count, failed_chunks, total_chunks, skipped_count, skipped_details")
      .eq("id", data.job_id)
      .maybeSingle();
    if (!job) return { status: "failed", inserted: 0, parsed: 0, message: "Job inesistente" };
    if (job.status === "cancelled" || job.status === "failed") {
      return { status: "skipped", inserted: 0, parsed: 0, message: "Job non attivo" };
    }

    let insertedCount = 0;
    let failed = false;
    let errorMessage: string | undefined;
    const skippedNow: Array<{ number: string | null; counterpart_name: string; issue_date: string | null; total_amount: number }> = [];

    if (data.invoices.length > 0) {
      const rows = data.invoices.map((it) => ({
        company_id: job.company_id,
        document_type: it.document_type,
        direction: it.direction,
        number: it.number,
        counterpart_name: it.counterpart_name,
        counterpart_vat: it.counterpart_vat,
        amount: it.amount ?? it.total_amount,
        vat_amount: it.vat_amount,
        total_amount: it.total_amount,
        paid_amount: it.paid_amount ?? undefined,
        issue_date: it.issue_date,
        due_date: it.due_date,
        status:
          it.paid_amount != null && it.paid_amount >= it.total_amount
            ? ("paid" as const)
            : ("sent" as const),
      }));
      const { data: ins, error: insErr } = await supabase
        .from("invoices")
        .upsert(rows, {
          onConflict: "company_id,direction,document_type,number,issue_date",
          ignoreDuplicates: true,
        })
        .select("id, number, document_type, issue_date");
      if (insErr) {
        console.error("[processInvoicesBatch] insert failed", insErr);
        failed = true;
        errorMessage = insErr.message;
      } else {
        insertedCount = ins?.length ?? 0;
        // Individua quali righe NON sono state inserite (scartate come duplicati)
        // confrontando la chiave (number, document_type, issue_date) con quelle restituite.
        const insertedKeys = new Set(
          (ins ?? []).map((r) => `${r.number ?? ""}|${r.document_type}|${r.issue_date ?? ""}`),
        );
        for (const it of data.invoices) {
          const key = `${it.number ?? ""}|${it.document_type}|${it.issue_date ?? ""}`;
          if (!insertedKeys.has(key)) {
            skippedNow.push({
              number: it.number,
              counterpart_name: it.counterpart_name,
              issue_date: it.issue_date,
              total_amount: it.total_amount,
            });
          }
        }
      }
    }

    const newProcessed = (job.processed_chunks ?? 0) + data.chunks_processed;
    const newInserted = (job.inserted_count ?? 0) + insertedCount;
    const newFailed = (job.failed_chunks ?? 0) + (failed ? data.chunks_processed : 0);
    // Limita l'elenco dettagliato a 300 voci per non far crescere troppo la riga; il conteggio resta sempre esatto.
    const prevSkippedCount = (job as unknown as { skipped_count?: number }).skipped_count ?? 0;
    const prevSkippedDetails = ((job as unknown as { skipped_details?: unknown[] }).skipped_details ?? []) as Array<Record<string, unknown>>;
    const newSkippedCount = prevSkippedCount + skippedNow.length;
    const newSkippedDetails = [...prevSkippedDetails, ...skippedNow].slice(0, 300);
    const isDone = newProcessed >= (job.total_chunks ?? 0);
    await supabase
      .from("import_jobs")
      .update({
        processed_chunks: newProcessed,
        inserted_count: newInserted,
        failed_chunks: newFailed,
        skipped_count: newSkippedCount,
        skipped_details: newSkippedDetails as unknown as import("@/integrations/supabase/types").Json,
        status: isDone ? "completed" : "processing",
        ...(errorMessage ? { error_message: errorMessage } : {}),
      })
      .eq("id", data.job_id);

    return {
      status: failed ? "failed" : "ok",
      inserted: insertedCount,
      parsed: data.invoices.length,
      message: errorMessage,
    };
  });

export const processImportChunk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ChunkSchema.parse(input))
  .handler(async ({ data, context }): Promise<ChunkResult> => {
    const supabase = context.supabase;

    const markFailed = async (errorMessage?: string) => {
      const { data: cur } = await supabase
        .from("import_jobs")
        .select("processed_chunks, failed_chunks, total_chunks")
        .eq("id", data.job_id)
        .maybeSingle();
      if (!cur) return;
      const newProcessed = (cur.processed_chunks ?? 0) + 1;
      const newFailed = (cur.failed_chunks ?? 0) + 1;
      const isDone = newProcessed >= (cur.total_chunks ?? 0);
      const update: {
        processed_chunks: number;
        failed_chunks: number;
        status: string;
        error_message?: string;
      } = {
        processed_chunks: newProcessed,
        failed_chunks: newFailed,
        status: isDone ? "completed" : "processing",
      };
      if (errorMessage) update.error_message = errorMessage;
      await supabase.from("import_jobs").update(update).eq("id", data.job_id);
    };

    const { data: job } = await supabase
      .from("import_jobs")
      .select("id, company_id, status, hint_direction")
      .eq("id", data.job_id)
      .maybeSingle();
    if (!job) return { status: "failed", inserted: 0, parsed: 0, message: "Job inesistente" };
    if (job.status === "cancelled" || job.status === "failed") {
      return { status: "skipped", inserted: 0, parsed: 0, message: "Job non attivo" };
    }

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      await markFailed("AI non configurata");
      return { status: "failed", inserted: 0, parsed: 0, message: "AI non configurata" };
    }

    const fallbackDir = (job.hint_direction as "attiva" | "passiva" | null) ?? "attiva";

    const systemPrompt = `Sei un estrattore di righe da elenchi di fatture italiani (export Danea, registri IVA, ecc.).
Ricevi un FRAMMENTO DI TESTO (poche decine di righe) estratto da un PDF. Restituisci SOLO un oggetto JSON:

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
      "amount": number|null,
      "vat_amount": number|null,
      "total_amount": number
    }
  ]
}

REGOLE:
- Importi sempre numeri (punto decimale, niente separatori migliaia o simbolo €). Positivi.
- Date in YYYY-MM-DD. Date italiane gg/mm/aaaa vanno convertite.
- Se le colonne tipiche Danea sono Num/Data/Tipo/Nominativo/Totale: number=Num, issue_date=Data, counterpart_name=Nominativo, total_amount=Totale, document_type da Tipo (Fattura/Nota di credito/Parcella/Ricevuta/DDT). amount e vat_amount possono restare null.
- Se la direction non è esplicita usa "${fallbackDir}".
- Niente righe inventate. Salta intestazioni, totali di pagina, righe vuote.
- Se non riconosci nessuna fattura nel frammento restituisci {"invoices": []}.`;

    let invoices: ExtractedInvoice[] = [];
    try {
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Estrai le fatture da questo frammento:\n\n${data.text}` },
          ],
          response_format: { type: "json_object" },
        }),
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        console.error("[processImportChunk] AI error", response.status, errText.slice(0, 200));
        const isCredit = response.status === 402 || (response.status === 403 && errText.includes("credit"));
        const msg = isCredit
          ? "Crediti AI esauriti"
          : response.status === 429
          ? "Rate limit AI"
          : `AI HTTP ${response.status}`;
        if (isCredit) {
          // Marca l'intero job come failed per fermare gli altri chunk
          await supabase
            .from("import_jobs")
            .update({ status: "failed", error_message: msg })
            .eq("id", data.job_id);
        } else {
          await markFailed(msg);
        }
        return { status: "failed", inserted: 0, parsed: 0, message: msg };
      }

      const json = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const content = json.choices?.[0]?.message?.content ?? "";
      let parsed: Record<string, unknown> = {};
      try {
        parsed = JSON.parse(content);
      } catch {
        const match = content.match(/\{[\s\S]*\}/);
        if (match) parsed = JSON.parse(match[0]);
      }

      const arr = Array.isArray(parsed.invoices) ? (parsed.invoices as unknown[]) : [];
      invoices = arr
        .map((raw) => {
          const o = (raw ?? {}) as Record<string, unknown>;
          const total = num(o.total_amount) ?? num(o.amount) ?? 0;
          const name = str(o.counterpart_name);
          if (!name || total <= 0) return null;
          return {
            document_type: docType(o.document_type),
            direction: direction(o.direction, fallbackDir),
            number: str(o.number),
            counterpart_name: name,
            counterpart_vat: str(o.counterpart_vat),
            issue_date: normalizeDate(o.issue_date),
            due_date: normalizeDate(o.due_date),
            amount: num(o.amount),
            vat_amount: num(o.vat_amount),
            total_amount: Number(total),
          } satisfies ExtractedInvoice;
        })
        .filter((x): x is ExtractedInvoice => x !== null);
    } catch (err) {
      console.error("[processImportChunk] parsing failed", err);
      await markFailed();
      return { status: "failed", inserted: 0, parsed: 0, message: err instanceof Error ? err.message : "errore" };
    }

    let insertedCount = 0;
    if (invoices.length > 0) {
      const rows = invoices.map((it) => ({
        company_id: job.company_id,
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

      const { data: ins, error: insErr } = await supabase
        .from("invoices")
        .upsert(rows, {
          onConflict: "company_id,direction,document_type,number,issue_date",
          ignoreDuplicates: true,
        })
        .select("id");

      if (insErr) {
        console.error("[processImportChunk] insert failed", insErr);
        await markFailed(insErr.message);
        return { status: "failed", inserted: 0, parsed: invoices.length, message: insErr.message };
      }
      insertedCount = ins?.length ?? 0;
    }

    const { data: cur } = await supabase
      .from("import_jobs")
      .select("processed_chunks, inserted_count, total_chunks")
      .eq("id", data.job_id)
      .maybeSingle();
    if (cur) {
      const newProcessed = (cur.processed_chunks ?? 0) + 1;
      const newInserted = (cur.inserted_count ?? 0) + insertedCount;
      const isDone = newProcessed >= (cur.total_chunks ?? 0);
      await supabase
        .from("import_jobs")
        .update({
          processed_chunks: newProcessed,
          inserted_count: newInserted,
          status: isDone ? "completed" : "processing",
        })
        .eq("id", data.job_id);
    }

    return { status: "ok", inserted: insertedCount, parsed: invoices.length };
  });

// =============================================================
// TAX PAYMENTS (F24) CRUD — invariato
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

// =============================================================
// Import Excel (documenti) — sincrono, senza job: l'Excel è già
// strutturato in colonne, quindi non serve chunking come per il PDF.
// =============================================================

const ExcelImportRowSchema = z.object({
  document_type: z.enum(["fattura", "parcella", "nota_credito", "ricevuta", "ddt"]),
  number: z.string().max(60).nullable(),
  counterpart_name: z.string().min(1).max(200),
  counterpart_vat: z.string().max(40).nullable(),
  issue_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  total_amount: z.number().positive(),
  payment_method: z.string().max(40).nullable(),
  notes: z.string().max(1000).nullable(),
});

const ExcelImportSchema = z.object({
  company_id: z.string().uuid(),
  direction: z.enum(["attiva", "passiva"]),
  rows: z.array(ExcelImportRowSchema).min(1).max(3000),
});

export const importInvoicesBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ExcelImportSchema.parse(input))
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
      throw new Error("Permessi insufficienti per importare documenti");
    }

    let inserted = 0;
    const skipped: Array<{ number: string | null; counterpart_name: string; issue_date: string | null; total_amount: number }> = [];

    const CHUNK = 300;
    for (let i = 0; i < data.rows.length; i += CHUNK) {
      const chunk = data.rows.slice(i, i + CHUNK);
      const payload = chunk.map((it) => ({
        company_id: data.company_id,
        direction: data.direction,
        document_type: it.document_type,
        number: it.number,
        counterpart_name: it.counterpart_name,
        counterpart_vat: it.counterpart_vat,
        amount: it.total_amount,
        vat_amount: null,
        total_amount: it.total_amount,
        issue_date: it.issue_date,
        due_date: it.due_date,
        status: "sent" as const,
        payment_method: it.payment_method,
        notes: it.notes,
      }));
      const { data: ins, error } = await supabase
        .from("invoices")
        .upsert(payload, {
          onConflict: "company_id,direction,document_type,number,issue_date",
          ignoreDuplicates: true,
        })
        .select("id, number, document_type, issue_date");
      if (error) throw new Error(error.message);
      inserted += ins?.length ?? 0;

      const insertedKeys = new Set((ins ?? []).map((r) => `${r.number ?? ""}|${r.document_type}|${r.issue_date ?? ""}`));
      for (const it of chunk) {
        const key = `${it.number ?? ""}|${it.document_type}|${it.issue_date ?? ""}`;
        if (!insertedKeys.has(key)) {
          skipped.push({
            number: it.number,
            counterpart_name: it.counterpart_name,
            issue_date: it.issue_date,
            total_amount: it.total_amount,
          });
        }
      }
    }

    return { inserted, total: data.rows.length, skipped_count: skipped.length, skipped: skipped.slice(0, 300) };
  });
