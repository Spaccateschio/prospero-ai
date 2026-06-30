import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type BalanceExtractedData = {
  // anagrafica
  legal_name: string | null;
  vat: string | null;
  period_start: string | null; // YYYY-MM-DD
  period_end: string | null;   // YYYY-MM-DD
  year: number | null;

  // Stato Patrimoniale
  attivo_totale: number | null;
  immobilizzazioni: number | null;
  crediti_clienti: number | null;
  liquidita: number | null;
  patrimonio_netto: number | null;
  debiti_banche_breve: number | null;
  debiti_banche_lungo: number | null;
  debiti_fornitori: number | null;
  debiti_tributari: number | null;
  tfr: number | null;

  // Conto Economico
  ricavi: number | null;
  costi_materie: number | null;
  costi_servizi: number | null;
  costi_personale: number | null;
  ammortamenti: number | null;
  oneri_finanziari: number | null;
  imposte: number | null;
  utile_netto: number | null;

  // Liste
  mutui: Array<{ descrizione: string; residuo: number | null }>;
  fornitori_top: Array<{ nome: string; importo: number | null }>;
};

export type BalanceMapped = {
  ricavi: number | null;
  ebitda: number | null;
  utile_netto: number | null;
  patrimonio_netto: number | null;
  debiti_totali: number | null;
  liquidita: number | null;
};

export type BalanceExtractionResult =
  | { status: "success"; data: BalanceExtractedData; mapped: BalanceMapped }
  | { status: "error"; message: string };

const InputSchema = z.object({
  pdf_base64: z.string().min(100).max(14_000_000),
  filename: z.string().max(200).optional(),
});

const num = (v: unknown): number | null => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    // gestisce "1.739.731,51" -> 1739731.51
    const cleaned = v.replace(/\s/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".").replace(/[^\d.-]/g, "");
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

export const extractBalanceData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data, context }): Promise<BalanceExtractionResult> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      return { status: "error", message: "Servizio AI non configurato." };
    }

    // Limite modalità prova
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("is_demo, ai_extractions_used")
      .eq("id", context.userId)
      .maybeSingle();
    if (profile?.is_demo && (profile.ai_extractions_used ?? 0) >= 1) {
      return {
        status: "error",
        message: "Hai usato l'estrazione AI gratuita della modalità prova. Registrati per continuare.",
      };
    }

    const systemPrompt = `Sei un estrattore di dati da bilanci d'esercizio italiani (società di capitali/persone), in formato Stato Patrimoniale + Conto Economico a sezioni contrapposte, anche post-imposte, con o senza piano dei conti dettagliato.
Restituisci SOLO un oggetto JSON valido con i campi richiesti. Usa null quando un valore non è presente o non è derivabile con certezza.
NON inventare dati. NON aggiungere testo fuori dal JSON. Tutti gli importi devono essere numeri (point decimal, senza separatori delle migliaia, senza simbolo €). I valori a debito/avere vanno sempre come positivi.

Regole di aggregazione (raggruppa le voci del piano dei conti quando serve):
- attivo_totale = totale attivo dello Stato Patrimoniale (sezione DARE)
- immobilizzazioni = somma immobilizzazioni materiali + immateriali + finanziarie al netto fondi amm.to
- crediti_clienti = crediti vs clienti / vs committenti
- liquidita = banche c/c attive + cassa + valori bollati
- patrimonio_netto = capitale sociale + riserve + utili/perdite a nuovo + utile/perdita esercizio
- debiti_banche_breve = mutui/finanziamenti in scadenza entro 12 mesi + scoperti c/c
- debiti_banche_lungo = mutui/finanziamenti oltre 12 mesi
- debiti_fornitori = debiti vs fornitori / vs fornitori per fatture da ricevere
- debiti_tributari = erario c/IVA, IRES, IRAP, ritenute da versare
- tfr = trattamento fine rapporto
- ricavi = ricavi delle vendite e prestazioni (escludi proventi straordinari)
- costi_materie = acquisti materie prime/merci/sussidiarie + variazione rimanenze materie
- costi_servizi = costi per servizi + costi godimento beni di terzi
- costi_personale = salari, stipendi, oneri sociali, TFR maturato, altri costi personale
- ammortamenti = ammortamenti immobilizzazioni + svalutazioni
- oneri_finanziari = interessi passivi e altri oneri finanziari
- imposte = imposte sul reddito d'esercizio (IRES + IRAP)
- utile_netto = utile/perdita d'esercizio post-imposte (segno negativo se perdita)

Liste:
- mutui: elenco dei mutui/finanziamenti bancari individuati (descrizione + residuo, se leggibile)
- fornitori_top: massimo 10 fornitori principali con importo dovuto (se elencati nel piano dei conti)

Periodo:
- period_start / period_end: estremi dell'esercizio (YYYY-MM-DD). Se non esplicito, ricava year dall'intestazione.

Schema atteso:
{
  "legal_name": "string", "vat": "string", "period_start": "YYYY-MM-DD|null", "period_end": "YYYY-MM-DD|null", "year": number|null,
  "attivo_totale": number|null, "immobilizzazioni": number|null, "crediti_clienti": number|null, "liquidita": number|null,
  "patrimonio_netto": number|null, "debiti_banche_breve": number|null, "debiti_banche_lungo": number|null,
  "debiti_fornitori": number|null, "debiti_tributari": number|null, "tfr": number|null,
  "ricavi": number|null, "costi_materie": number|null, "costi_servizi": number|null, "costi_personale": number|null,
  "ammortamenti": number|null, "oneri_finanziari": number|null, "imposte": number|null, "utile_netto": number|null,
  "mutui": [{"descrizione": "string", "residuo": number|null}],
  "fornitori_top": [{"nome": "string", "importo": number|null}]
}`;

    try {
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: [
                { type: "text", text: "Estrai i dati dal bilancio allegato e restituisci il JSON nel formato indicato. Aggrega le voci del piano dei conti per popolare gli aggregati richiesti." },
                {
                  type: "file",
                  file: {
                    filename: data.filename ?? "bilancio.pdf",
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
        if (response.status === 429) {
          return { status: "error", message: "Troppe richieste, riprova tra qualche secondo." };
        }
        if (response.status === 402) {
          return { status: "error", message: "Crediti AI esauriti. Aggiungili da Settings → Plans & credits." };
        }
        console.error("[extractBalanceData] AI gateway error", response.status, errText);
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

      const extracted: BalanceExtractedData = {
        legal_name: str(parsed.legal_name),
        vat: str(parsed.vat),
        period_start: str(parsed.period_start),
        period_end: str(parsed.period_end),
        year: num(parsed.year) ?? (() => {
          const pe = str(parsed.period_end);
          if (pe) {
            const m = pe.match(/^(\d{4})/);
            if (m) return Number(m[1]);
          }
          return null;
        })(),
        attivo_totale: num(parsed.attivo_totale),
        immobilizzazioni: num(parsed.immobilizzazioni),
        crediti_clienti: num(parsed.crediti_clienti),
        liquidita: num(parsed.liquidita),
        patrimonio_netto: num(parsed.patrimonio_netto),
        debiti_banche_breve: num(parsed.debiti_banche_breve),
        debiti_banche_lungo: num(parsed.debiti_banche_lungo),
        debiti_fornitori: num(parsed.debiti_fornitori),
        debiti_tributari: num(parsed.debiti_tributari),
        tfr: num(parsed.tfr),
        ricavi: num(parsed.ricavi),
        costi_materie: num(parsed.costi_materie),
        costi_servizi: num(parsed.costi_servizi),
        costi_personale: num(parsed.costi_personale),
        ammortamenti: num(parsed.ammortamenti),
        oneri_finanziari: num(parsed.oneri_finanziari),
        imposte: num(parsed.imposte),
        utile_netto: num(parsed.utile_netto),
        mutui: Array.isArray(parsed.mutui)
          ? (parsed.mutui as unknown[]).slice(0, 20).map((m) => {
              const o = (m ?? {}) as Record<string, unknown>;
              return { descrizione: str(o.descrizione) ?? "—", residuo: num(o.residuo) };
            })
          : [],
        fornitori_top: Array.isArray(parsed.fornitori_top)
          ? (parsed.fornitori_top as unknown[]).slice(0, 10).map((m) => {
              const o = (m ?? {}) as Record<string, unknown>;
              return { nome: str(o.nome) ?? "—", importo: num(o.importo) };
            })
          : [],
      };

      const ebitda =
        extracted.ricavi != null
          ? extracted.ricavi -
            (extracted.costi_materie ?? 0) -
            (extracted.costi_servizi ?? 0) -
            (extracted.costi_personale ?? 0)
          : null;

      const debitiTotali =
        (extracted.debiti_banche_breve ?? 0) +
          (extracted.debiti_banche_lungo ?? 0) +
          (extracted.debiti_fornitori ?? 0) +
          (extracted.debiti_tributari ?? 0) +
          (extracted.tfr ?? 0) || null;

      const mapped: BalanceMapped = {
        ricavi: extracted.ricavi,
        ebitda,
        utile_netto: extracted.utile_netto,
        patrimonio_netto: extracted.patrimonio_netto,
        debiti_totali: debitiTotali,
        liquidita: extracted.liquidita,
      };

      const hasAnyValue = Object.entries(extracted).some(
        ([k, v]) => !["mutui", "fornitori_top"].includes(k) && v != null && v !== "",
      );
      if (!hasAnyValue) {
        return { status: "error", message: "Nessun dato estratto: il PDF potrebbe non essere un bilancio leggibile." };
      }

      if (profile?.is_demo) {
        await context.supabase.rpc("increment_ai_extractions");
      }

      return { status: "success", data: extracted, mapped };
    } catch (err) {
      console.error("[extractBalanceData] failed", err);
      return {
        status: "error",
        message: err instanceof Error ? err.message : "Errore imprevisto durante l'estrazione.",
      };
    }
  });

// =============================================================
// Salvataggio: inserisce il bilancio confermato dall'utente
// =============================================================

const SaveSchema = z.object({
  company_id: z.string().uuid(),
  year: z.number().int().min(1990).max(2100),
  extracted_data: z.record(z.string(), z.unknown()),
  ricavi: z.number().nullable(),
  ebitda: z.number().nullable(),
  utile_netto: z.number().nullable(),
  patrimonio_netto: z.number().nullable(),
  debiti_totali: z.number().nullable(),
  liquidita: z.number().nullable(),
  raw_file_url: z.string().url().nullable().optional(),
});

export const saveBalanceSheet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SaveSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { error, data: row } = await context.supabase
      .from("balance_sheets")
      .insert({
        company_id: data.company_id,
        year: data.year,
        source_type: "pdf_ai",
        extracted_data: data.extracted_data as never,
        ricavi: data.ricavi,
        ebitda: data.ebitda,
        utile_netto: data.utile_netto,
        patrimonio_netto: data.patrimonio_netto,
        debiti_totali: data.debiti_totali,
        liquidita: data.liquidita,
        raw_file_url: data.raw_file_url ?? null,
        confirmed: true,
      })
      .select("id, year")
      .single();
    if (error) {
      console.error("[saveBalanceSheet] insert failed", error);
      throw new Error(error.message);
    }
    return row;
  });

const ListSchema = z.object({ company_id: z.string().uuid() });

export const listBalanceSheets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ListSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("balance_sheets")
      .select("id, year, ricavi, ebitda, utile_netto, patrimonio_netto, debiti_totali, liquidita, raw_file_url, extracted_data, created_at")
      .eq("company_id", data.company_id)
      .order("year", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

const DeleteSchema = z.object({ id: z.string().uuid(), company_id: z.string().uuid() });

export const deleteBalanceSheet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => DeleteSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("balance_sheets")
      .delete()
      .eq("id", data.id)
      .eq("company_id", data.company_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
