import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Forma normalizzata dei dati restituiti dai provider di verifica P.IVA.
 * I provider diversi mappano i loro campi su questa struttura.
 */
export type NormalizedCompanyData = {
  vat: string;
  fiscal_code?: string | null;
  legal_name?: string | null;
  legal_form?: string | null;
  pec_email?: string | null;
  sdi_code?: string | null;
  rea_code?: string | null;
  chamber_of_commerce?: string | null;
  ateco?: string | null;
  ateco_description?: string | null;
  activity_status?: string | null;
  activity_start_date?: string | null; // ISO date
  legal_address_street?: string | null;
  city?: string | null;
  province?: string | null;
  region?: string | null;
  zip_code?: string | null;
  /** Numero dipendenti (se restituito dal provider) */
  employees_count?: number | null;
  /** Anno di costituzione (se restituito) */
  founded_year?: number | null;
};

export type VatLookupResult =
  | {
      status: "success";
      provider: string;
      data: NormalizedCompanyData;
      verifiedFields: string[];
      rawKeys?: string[];
    }
  | { status: "not_found"; provider: string; message: string; rawKeys?: string[] }
  | { status: "error"; provider: string; message: string; rawKeys?: string[] };

// -----------------------------------------------------------------------------
// Provider implementations (server-only)
// -----------------------------------------------------------------------------

interface VatProvider {
  readonly name: string;
  lastRaw?: Record<string, unknown> | null;
  lookup(vat: string): Promise<VatLookupResult>;
}

/**
 * Provider OpenAPI.com — pacchetto IT-START / Imprese.
 * Doc: https://docs.openapi.com → settore "Imprese"
 *
 * Endpoint tipico: GET https://imprese.openapi.com/advance/{vat}
 * Header: Authorization: Bearer <OPENAPI_VAT_TOKEN>
 *
 * NOTA: la shape esatta della risposta va verificata con la doc del piano
 * sottoscritto. I mapping qui sotto coprono i campi più comuni: se il provider
 * usa nomi diversi, modificare solo la funzione `mapOpenApiPayload`.
 */
class OpenApiProvider implements VatProvider {
  readonly name = "openapi";
  lastRaw: Record<string, unknown> | null = null;
  constructor(private token: string) {}

  async lookup(vat: string): Promise<VatLookupResult> {
    // Endpoint OpenAPI.it — servizio Company (pacchetti attuali):
    // IT-marketing → anagrafica completa + dipendenti + ATECO + indirizzo
    // IT-full      → visura camerale completa (fallback se marketing non incluso)
    const endpoints = [
      `https://company.openapi.com/IT-marketing/${encodeURIComponent(vat)}`,
      `https://company.openapi.com/IT-full/${encodeURIComponent(vat)}`,
    ];

    let lastError = "Errore di rete";
    for (const url of endpoints) {
      try {
        const res = await fetch(url, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${this.token}`,
            Accept: "application/json",
          },
        });

        if (res.status === 404) {
          lastError = "Partita IVA non trovata";
          continue;
        }
        if (res.status === 401 || res.status === 403) {
          const text = await res.text().catch(() => "");
          // 401/403 può significare: token non valido OPPURE pacchetto non incluso nell'abbonamento.
          lastError = `OpenAPI ${res.status}: ${text.slice(0, 200) || res.statusText}. Verifica che il token sia valido e che il pacchetto sia attivo nel tuo abbonamento.`;
          continue;
        }
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          lastError = `OpenAPI ${res.status}: ${text.slice(0, 200) || res.statusText}`;
          continue;
        }

        const json = (await res.json()) as Record<string, unknown>;
        this.lastRaw = json;
        const mapped = mapOpenApiPayload(vat, json);
        if (!mapped) {
          lastError = "Risposta vuota dal provider";
          continue;
        }
        return {
          status: "success",
          provider: this.name,
          data: mapped,
          verifiedFields: verifiedFieldsOf(mapped),
          rawKeys: collectKeys(json),
        };
      } catch (err) {
        lastError = err instanceof Error ? err.message : "Errore di rete";
      }
    }

    return { status: "error", provider: this.name, message: lastError };
  }
}



/**
 * MockProvider — usato quando non è configurato alcun provider esterno.
 * Restituisce sempre `not_found` così l'utente compila a mano,
 * ma viene comunque salvata la verifica in audit.
 */
class MockProvider implements VatProvider {
  readonly name = "mock";
  async lookup(_vat: string): Promise<VatLookupResult> {
    return {
      status: "not_found",
      provider: this.name,
      message:
        "Verifica automatica non configurata. Compila i dati manualmente — potrai attivare la verifica dalle impostazioni.",
    };
  }
}

function selectProvider(): VatProvider {
  // Accetta sia il nuovo nome (OPENAPI_COMPANY_TOKEN) sia il vecchio (OPENAPI_VAT_TOKEN)
  const token = process.env.OPENAPI_COMPANY_TOKEN ?? process.env.OPENAPI_VAT_TOKEN;
  if (token && token.trim().length > 0) return new OpenApiProvider(token.trim());
  return new MockProvider();
}

// Mapping helpers ------------------------------------------------------------

function pickString(...values: unknown[]): string | null {
  for (const v of values) {
    if (typeof v === "string" && v.trim().length > 0) return v.trim();
  }
  return null;
}

function pickPath(obj: unknown, path: string): unknown {
  if (!obj || typeof obj !== "object") return undefined;
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

function pickNumber(...values: unknown[]): number | null {
  for (const v of values) {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim().length > 0) {
      const n = Number(v.replace(/[^\d.-]/g, ""));
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

function collectKeys(obj: unknown, depth = 0, max = 3, acc: Set<string> = new Set()): string[] {
  if (!obj || typeof obj !== "object" || depth > max) return Array.from(acc);
  if (Array.isArray(obj)) {
    for (const it of obj.slice(0, 2)) collectKeys(it, depth + 1, max, acc);
    return Array.from(acc);
  }
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    acc.add(k);
    if (v && typeof v === "object") collectKeys(v, depth + 1, max, acc);
  }
  return Array.from(acc);
}

/** Deeply walk obj/arrays looking for the first matching key (case-insensitive). */
function deepFind(obj: unknown, keys: string[], depth = 0): unknown {
  if (obj == null || depth > 6) return undefined;
  const lowered = keys.map((k) => k.toLowerCase());
  if (Array.isArray(obj)) {
    for (const it of obj) {
      const r = deepFind(it, keys, depth + 1);
      if (r != null && r !== "") return r;
    }
    return undefined;
  }
  if (typeof obj === "object") {
    const rec = obj as Record<string, unknown>;
    for (const [k, v] of Object.entries(rec)) {
      if (lowered.includes(k.toLowerCase()) && v != null && v !== "") return v;
    }
    for (const v of Object.values(rec)) {
      const r = deepFind(v, keys, depth + 1);
      if (r != null && r !== "") return r;
    }
  }
  return undefined;
}

function asString(v: unknown): string | null {
  if (typeof v === "string" && v.trim()) return v.trim();
  if (typeof v === "number") return String(v);
  return null;
}

function asNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v.replace(/[^\d.-]/g, ""));
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function mapOpenApiPayload(vat: string, payload: Record<string, unknown>): NormalizedCompanyData | null {
  // {success, data: {...}} | {data: [...]} | {...}
  const dataRaw = (payload.data ?? payload) as unknown;
  const root = Array.isArray(dataRaw) ? (dataRaw[0] as unknown) : dataRaw;
  if (!root || typeof root !== "object") return null;

  // legal address subtree (try multiple shapes)
  const address =
    (deepFind(root, ["address", "indirizzo", "sede_legale", "registered_address", "legal_address"]) as
      | Record<string, unknown>
      | undefined) ?? (root as Record<string, unknown>);

  const activityStart = asString(
    deepFind(root, [
      "activity_start", "activity_start_date", "data_inizio_attivita",
      "start_date", "data_iscrizione", "registration_date",
    ]),
  );
  const foundedYear =
    asNumber(deepFind(root, ["founded_year", "anno_costituzione", "year_of_constitution"])) ??
    (activityStart ? asNumber(activityStart.slice(0, 4)) : null);

  const employeesRaw = deepFind(root, [
    "employees", "dipendenti", "employees_count", "numero_dipendenti", "n_dipendenti",
  ]);
  const employees =
    asNumber(employeesRaw) ??
    asNumber(deepFind(employeesRaw, ["count", "total", "last_value", "value", "number"]));

  return {
    vat,
    fiscal_code: asString(deepFind(root, ["tax_code", "codice_fiscale", "cf", "fiscal_code"])),
    legal_name: asString(
      deepFind(root, ["company_name", "denomination", "denominazione", "ragione_sociale", "name", "business_name"]),
    ),
    legal_form: asString(deepFind(root, ["company_type", "legal_form", "forma_giuridica", "natura_giuridica"])),
    pec_email: asString(deepFind(root, ["pec", "pec_email", "pec_mail", "indirizzo_pec"])),
    sdi_code: asString(deepFind(root, ["sdi_code", "codice_destinatario", "sdi", "codice_sdi"])),
    rea_code: asString(deepFind(root, ["rea", "rea_code", "numero_rea", "n_rea"])),
    chamber_of_commerce: asString(deepFind(root, ["cciaa", "chamber_of_commerce", "chamber", "camera_commercio"])),
    ateco: asString(deepFind(root, ["ateco_code", "codice_ateco", "ateco"])),
    ateco_description: asString(deepFind(root, ["ateco_description", "descrizione_ateco", "activity_description"])),
    activity_status: asString(deepFind(root, ["status", "activity_status", "stato_attivita", "stato"])),
    activity_start_date: activityStart,
    legal_address_street: asString(
      deepFind(address, ["street", "toponym", "via", "indirizzo", "address", "street_name"]),
    ),
    city: asString(deepFind(address, ["city", "town", "comune", "municipality"])),
    province: asString(deepFind(address, ["province", "provincia", "prov", "province_code"])),
    region: asString(deepFind(address, ["region", "regione"])),
    zip_code: asString(deepFind(address, ["zip_code", "postcode", "cap", "postal_code", "zip"])),
    employees_count: employees,
    founded_year: foundedYear,
  };
}

function verifiedFieldsOf(data: NormalizedCompanyData): string[] {
  return Object.entries(data)
    .filter(([k, v]) => k !== "vat" && v != null && String(v).length > 0)
    .map(([k]) => k);
}

// -----------------------------------------------------------------------------
// Server function: lookupVatNumber
// -----------------------------------------------------------------------------

const VAT_REGEX = /^[A-Z]{0,2}\d{8,16}$/i;

export const lookupVatNumber = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        vat: z.string().trim().min(8).max(20).refine((v) => VAT_REGEX.test(v), {
          message: "Formato Partita IVA non valido",
        }),
        company_id: z.string().uuid().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const provider = selectProvider();

    // Normalizza la P.IVA: rimuovi prefisso 'IT' se presente
    const cleanVat = data.vat.toUpperCase().replace(/^IT/, "");

    const result = await provider.lookup(cleanVat);

    // Audit: salva sempre la chiamata (anche se fallita)
    await supabase.from("company_verifications").insert({
      company_id: data.company_id ?? null,
      vat_queried: cleanVat,
      provider: result.provider,
      status: result.status,
      raw_response: result.status === "success" ? (JSON.parse(JSON.stringify(result.data)) as never) : null,
      error_message: result.status !== "success" ? result.message : null,
      requested_by: userId,
    });

    return result;
  });
