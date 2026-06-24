import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { NormalizedCompanyData } from "@/lib/vat-lookup.functions";

export type VisuraExtras = {
  founded_year: number | null;
  employees_count: number | null;
  iso_certifications: string[];
};

export type VisuraExtractionResult =
  | { status: "success"; data: NormalizedCompanyData; extras: VisuraExtras; extractedFields: string[] }
  | { status: "error"; message: string };

const InputSchema = z.object({
  /** PDF della visura codificato in base64 (senza prefisso data:...) */
  pdf_base64: z.string().min(100),
  /** Nome file (per debug/log) */
  filename: z.string().optional(),
});

const ITALIAN_PROVINCE_TO_REGION: Record<string, string> = {
  AG: "Sicilia", AL: "Piemonte", AN: "Marche", AO: "Valle d'Aosta", AR: "Toscana",
  AP: "Marche", AT: "Piemonte", AV: "Campania", BA: "Puglia", BT: "Puglia",
  BL: "Veneto", BN: "Campania", BG: "Lombardia", BI: "Piemonte", BO: "Emilia-Romagna",
  BZ: "Trentino-Alto Adige", BS: "Lombardia", BR: "Puglia", CA: "Sardegna",
  CL: "Sicilia", CB: "Molise", CE: "Campania", CT: "Sicilia", CZ: "Calabria",
  CH: "Abruzzo", CO: "Lombardia", CS: "Calabria", CR: "Lombardia", KR: "Calabria",
  CN: "Piemonte", EN: "Sicilia", FM: "Marche", FE: "Emilia-Romagna", FI: "Toscana",
  FG: "Puglia", FC: "Emilia-Romagna", FR: "Lazio", GE: "Liguria", GO: "Friuli-Venezia Giulia",
  GR: "Toscana", IM: "Liguria", IS: "Molise", AQ: "Abruzzo", SP: "Liguria",
  LT: "Lazio", LE: "Puglia", LC: "Lombardia", LI: "Toscana", LO: "Lombardia",
  LU: "Toscana", MC: "Marche", MN: "Lombardia", MS: "Toscana", MT: "Basilicata",
  ME: "Sicilia", MI: "Lombardia", MO: "Emilia-Romagna", MB: "Lombardia", NA: "Campania",
  NO: "Piemonte", NU: "Sardegna", OR: "Sardegna", PD: "Veneto", PA: "Sicilia",
  PR: "Emilia-Romagna", PV: "Lombardia", PG: "Umbria", PU: "Marche", PE: "Abruzzo",
  PC: "Emilia-Romagna", PI: "Toscana", PT: "Toscana", PN: "Friuli-Venezia Giulia",
  PZ: "Basilicata", PO: "Toscana", RG: "Sicilia", RA: "Emilia-Romagna", RC: "Calabria",
  RE: "Emilia-Romagna", RI: "Lazio", RN: "Emilia-Romagna", RM: "Lazio", RO: "Veneto",
  SA: "Campania", SS: "Sardegna", SV: "Liguria", SI: "Toscana", SR: "Sicilia",
  SO: "Lombardia", SU: "Sardegna", TA: "Puglia", TE: "Abruzzo", TR: "Umbria",
  TO: "Piemonte", TP: "Sicilia", TN: "Trentino-Alto Adige", TV: "Veneto", TS: "Friuli-Venezia Giulia",
  UD: "Friuli-Venezia Giulia", VA: "Lombardia", VE: "Veneto", VB: "Piemonte",
  VC: "Piemonte", VR: "Veneto", VV: "Calabria", VI: "Veneto", VT: "Lazio",
};

export const extractVisuraData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data, context }): Promise<VisuraExtractionResult> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      return { status: "error", message: "Servizio AI non configurato." };
    }

    // Limite modalità prova: 1 estrazione AI gratuita
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

    const systemPrompt = `Sei un estrattore di dati da visure camerali italiane (Registro Imprese).
Restituisci SOLO un oggetto JSON valido con i campi richiesti. Se un campo non è presente nella visura, usa null.
NON inventare dati. NON aggiungere testo fuori dal JSON.

Schema atteso:
{
  "vat": "string (Partita IVA, 11 cifre)",
  "fiscal_code": "string (Codice Fiscale)",
  "legal_name": "string (Denominazione / Ragione sociale)",
  "legal_form": "string (es. SOCIETA' A RESPONSABILITA' LIMITATA)",
  "company_type": "srl|srls|spa|sapa|snc|sas|ditta_individuale|cooperativa|altro",
  "pec_email": "string (indirizzo PEC)",
  "rea_code": "string (formato XX-1234567)",
  "chamber_of_commerce": "string (Camera di Commercio di ...)",
  "ateco": "string (codice ATECO, es. 46.31.10) o null se non presente",
  "ateco_description": "string (descrizione attività prevalente)",
  "activity_status": "string (es. ATTIVA, INATTIVA, CESSATA)",
  "activity_start_date": "string (YYYY-MM-DD)",
  "legal_address_street": "string (via e numero civico)",
  "city": "string (comune)",
  "province": "string (sigla provincia, 2 lettere maiuscole, es. RM)",
  "zip_code": "string (CAP, 5 cifre)",
  "founded_year": "number (anno di costituzione/fondazione, es. 2012) o null",
  "employees_count": "number (numero dipendenti / addetti se presente, es. dalla sezione 'Numero addetti' o 'Dipendenti') o null",
  "iso_certifications": "array di stringhe tra: iso_9001, iso_14001, iso_45001, iso_50001, iso_27001 (solo se esplicitamente citate nella visura, altrimenti [])"
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
                { type: "text", text: "Estrai i dati anagrafici dalla visura allegata e restituiscili nel formato JSON specificato." },
                {
                  type: "file",
                  file: {
                    filename: data.filename ?? "visura.pdf",
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
        console.error("[extractVisuraData] AI gateway error", response.status, errText);
        return { status: "error", message: `Errore estrazione (HTTP ${response.status}).` };
      }

      const json = await response.json() as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = json.choices?.[0]?.message?.content;
      if (!content) {
        return { status: "error", message: "Risposta AI vuota." };
      }

      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(content);
      } catch {
        // Tenta di estrarre il primo blocco JSON
        const match = content.match(/\{[\s\S]*\}/);
        if (!match) return { status: "error", message: "Formato risposta AI non valido." };
        parsed = JSON.parse(match[0]);
      }

      const str = (v: unknown): string | null => {
        if (typeof v !== "string") return null;
        const t = v.trim();
        return t.length > 0 && t.toLowerCase() !== "null" ? t : null;
      };

      const province = str(parsed.province)?.toUpperCase() ?? null;
      const region = province && ITALIAN_PROVINCE_TO_REGION[province]
        ? ITALIAN_PROVINCE_TO_REGION[province]
        : null;

      const normalized: NormalizedCompanyData = {
        vat: str(parsed.vat) ?? "",
        fiscal_code: str(parsed.fiscal_code),
        legal_name: str(parsed.legal_name),
        legal_form: str(parsed.legal_form),
        pec_email: str(parsed.pec_email),
        sdi_code: null, // non presente in visura
        rea_code: str(parsed.rea_code),
        chamber_of_commerce: str(parsed.chamber_of_commerce),
        ateco: str(parsed.ateco),
        ateco_description: str(parsed.ateco_description),
        activity_status: str(parsed.activity_status),
        activity_start_date: str(parsed.activity_start_date),
        legal_address_street: str(parsed.legal_address_street),
        city: str(parsed.city),
        province,
        region,
        zip_code: str(parsed.zip_code),
      };

      const num = (v: unknown): number | null => {
        if (typeof v === "number" && Number.isFinite(v)) return v;
        if (typeof v === "string" && v.trim()) {
          const n = Number(v.replace(/[^\d.-]/g, ""));
          return Number.isFinite(n) ? n : null;
        }
        return null;
      };
      const VALID_ISO = new Set(["iso_9001", "iso_14001", "iso_45001", "iso_50001", "iso_27001"]);
      const isoArr = Array.isArray(parsed.iso_certifications)
        ? (parsed.iso_certifications as unknown[])
            .map((x) => (typeof x === "string" ? x.trim().toLowerCase() : ""))
            .filter((x) => VALID_ISO.has(x))
        : [];

      let founded = num(parsed.founded_year);
      if (!founded && normalized.activity_start_date) {
        const m = normalized.activity_start_date.match(/^(\d{4})/);
        if (m) founded = Number(m[1]);
      }
      if (founded && (founded < 1800 || founded > new Date().getFullYear())) founded = null;

      const employees = num(parsed.employees_count);
      const extras: VisuraExtras = {
        founded_year: founded,
        employees_count: employees && employees >= 0 ? Math.round(employees) : null,
        iso_certifications: isoArr,
      };

      const extractedFields = Object.entries(normalized)
        .filter(([, v]) => v != null && v !== "")
        .map(([k]) => k);
      if (extras.founded_year != null) extractedFields.push("founded_year");
      if (extras.employees_count != null) extractedFields.push("employees_count");
      if (extras.iso_certifications.length > 0) extractedFields.push("iso_certifications");

      if (extractedFields.length === 0) {
        return { status: "error", message: "Nessun dato estratto: il PDF potrebbe non essere una visura." };
      }

      return { status: "success", data: normalized, extras, extractedFields };
    } catch (err) {
      console.error("[extractVisuraData] failed", err);
      return {
        status: "error",
        message: err instanceof Error ? err.message : "Errore imprevisto durante l'estrazione.",
      };
    }
  });
