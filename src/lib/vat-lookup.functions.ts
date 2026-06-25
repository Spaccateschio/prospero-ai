import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Bilancio sintetico restituito da OpenAPI (blocco `ecofin`).
 * Solo i dati di sintesi sono inclusi nel pacchetto IT-marketing.
 */
export type EcofinSummary = {
  year: number | null;
  turnover: number | null;
  net_worth: number | null;
  share_capital: number | null;
  balance_sheet_date: string | null;
};

/**
 * Forma normalizzata dei dati restituiti dai provider di verifica P.IVA.
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
  activity_start_date?: string | null;
  legal_address_street?: string | null;
  city?: string | null;
  province?: string | null;
  region?: string | null;
  zip_code?: string | null;
  employees_count?: number | null;
  founded_year?: number | null;
  /** Bilancio sintetico (se restituito dal provider) */
  ecofin?: EcofinSummary | null;
};

export type VatLookupResult =
  | {
      status: "success";
      provider: string;
      data: NormalizedCompanyData;
      verifiedFields: string[];
    }
  | { status: "not_found"; provider: string; message: string }
  | { status: "error"; provider: string; message: string };

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function get(obj: unknown, path: string): unknown {
  if (obj == null) return undefined;
  let cur: unknown = obj;
  for (const seg of path.split(".")) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[seg];
  }
  return cur;
}

function asString(v: unknown): string | null {
  if (typeof v === "string" && v.trim()) return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
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

function firstString(obj: unknown, paths: string[]): string | null {
  for (const p of paths) {
    const v = asString(get(obj, p));
    if (v) return v;
  }
  return null;
}

function firstNumber(obj: unknown, paths: string[]): number | null {
  for (const p of paths) {
    const v = asNumber(get(obj, p));
    if (v != null) return v;
  }
  return null;
}

// -----------------------------------------------------------------------------
// Mapping OpenAPI IT-marketing → NormalizedCompanyData
// -----------------------------------------------------------------------------

function mapOpenApiPayload(vat: string, payload: Record<string, unknown>): NormalizedCompanyData | null {
  const dataRaw = (payload.data ?? payload) as unknown;
  const root = (Array.isArray(dataRaw) ? dataRaw[0] : dataRaw) as Record<string, unknown> | null;
  if (!root || typeof root !== "object") return null;

  const ecofinRaw = get(root, "ecofin") as Record<string, unknown> | undefined;
  const turnoverYear = firstNumber(ecofinRaw, ["turnoverYear", "year"]);
  const balanceDate = firstString(ecofinRaw, ["balanceSheetDate"]);
  const ecofin: EcofinSummary | null = ecofinRaw
    ? {
        year: turnoverYear ?? (balanceDate ? Number(balanceDate.slice(0, 4)) : null),
        turnover: firstNumber(ecofinRaw, ["turnover", "revenue"]),
        net_worth: firstNumber(ecofinRaw, ["netWorth"]),
        share_capital: firstNumber(ecofinRaw, ["shareCapital"]),
        balance_sheet_date: balanceDate,
      }
    : null;

  const employees =
    firstNumber(root, ["employees.employee", "employees.count", "employees.total"]) ??
    firstNumber(root, ["employees"]);

  return {
    vat,
    fiscal_code: firstString(root, [
      "companyDetails.taxCode",
      "taxCode",
      "tax_code",
      "codice_fiscale",
    ]),
    legal_name: firstString(root, [
      "companyDetails.companyName",
      "companyName",
      "company_name",
      "denominazione",
    ]),
    legal_form: firstString(root, [
      "companyDetails.companyType.description",
      "companyDetails.companyType",
      "companyType.description",
      "legal_form",
    ]),
    pec_email: firstString(root, ["pec", "pec_email", "indirizzo_pec"]),
    sdi_code: firstString(root, ["sdiCode", "sdi_code", "codice_destinatario"]),
    rea_code: firstString(root, ["companyDetails.reaCode", "reaCode", "rea"]),
    chamber_of_commerce: firstString(root, ["companyDetails.cciaa", "cciaa"]),
    ateco: firstString(root, [
      "atecoClassification.ateco.code",
      "atecoClassification.code",
      "ateco.code",
      "ateco",
    ]),
    ateco_description: firstString(root, [
      "atecoClassification.ateco.description",
      "atecoClassification.description",
      "ateco.description",
    ]),
    activity_status: firstString(root, [
      "companyStatus.activityStatus.description",
      "companyStatus.activityStatus",
      "activityStatus.description",
      "activityStatus",
    ]),
    activity_start_date: firstString(root, [
      "companyDetails.startDate",
      "activity_start_date",
      "data_inizio_attivita",
    ]),
    legal_address_street: firstString(root, [
      "address.streetName",
      "address.street",
      "address.toponym",
    ]),
    city: firstString(root, ["address.town", "address.city", "address.comune"]),
    province: firstString(root, [
      "address.province.code",
      "address.province",
      "address.provincia",
    ]),
    region: firstString(root, [
      "address.region.description",
      "address.region",
      "address.regione",
    ]),
    zip_code: firstString(root, ["address.zipCode", "address.cap", "address.postcode"]),
    employees_count: employees,
    founded_year:
      firstNumber(root, ["founded_year", "anno_costituzione"]) ??
      (firstString(root, ["companyDetails.startDate"])?.slice(0, 4)
        ? Number(firstString(root, ["companyDetails.startDate"])!.slice(0, 4))
        : null),
    ecofin,
  };
}

function verifiedFieldsOf(data: NormalizedCompanyData): string[] {
  return Object.entries(data)
    .filter(([k, v]) => k !== "vat" && k !== "ecofin" && v != null && String(v).length > 0)
    .map(([k]) => k);
}

// -----------------------------------------------------------------------------
// Providers
// -----------------------------------------------------------------------------

interface VatProvider {
  readonly name: string;
  lastRaw?: Record<string, unknown> | null;
  lookup(vat: string): Promise<VatLookupResult>;
}

class OpenApiProvider implements VatProvider {
  readonly name = "openapi";
  lastRaw: Record<string, unknown> | null = null;
  constructor(private token: string) {}

  async lookup(vat: string): Promise<VatLookupResult> {
    const endpoints = [
      `https://company.openapi.com/IT-marketing/${encodeURIComponent(vat)}`,
      `https://company.openapi.com/IT-full/${encodeURIComponent(vat)}`,
    ];

    let lastError = "Errore di rete";
    for (const url of endpoints) {
      try {
        const res = await fetch(url, {
          method: "GET",
          headers: { Authorization: `Bearer ${this.token}`, Accept: "application/json" },
        });
        if (res.status === 404) { lastError = "Partita IVA non trovata"; continue; }
        if (res.status === 401 || res.status === 403) {
          const text = await res.text().catch(() => "");
          lastError = `OpenAPI ${res.status}: ${text.slice(0, 200) || res.statusText}.`;
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
        if (!mapped) { lastError = "Risposta vuota dal provider"; continue; }
        return {
          status: "success",
          provider: this.name,
          data: mapped,
          verifiedFields: verifiedFieldsOf(mapped),
        };
      } catch (err) {
        lastError = err instanceof Error ? err.message : "Errore di rete";
      }
    }
    return { status: "error", provider: this.name, message: lastError };
  }
}

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
  const token = process.env.OPENAPI_COMPANY_TOKEN ?? process.env.OPENAPI_VAT_TOKEN;
  if (token && token.trim().length > 0) return new OpenApiProvider(token.trim());
  return new MockProvider();
}

// -----------------------------------------------------------------------------
// Server fn: lookupVatNumber
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
    const cleanVat = data.vat.toUpperCase().replace(/^IT/, "");

    const result = await provider.lookup(cleanVat);
    const rawJson = provider.lastRaw ?? null;

    await supabase.from("company_verifications").insert({
      company_id: data.company_id ?? null,
      vat_queried: cleanVat,
      provider: result.provider,
      status: result.status,
      raw_response: rawJson ? (JSON.parse(JSON.stringify(rawJson)) as never) : null,
      error_message: result.status !== "success" ? result.message : null,
      requested_by: userId,
    });

    return result;
  });

// -----------------------------------------------------------------------------
// Server fn: requestCompanyVisuraPdf
// Tenta vari endpoint OpenAPI per la visura camerale (richiede pacchetto attivo).
// -----------------------------------------------------------------------------

export type VisuraPdfResult =
  | { status: "success"; provider: string; downloadUrl: string; raw: unknown }
  | { status: "pending"; provider: string; requestId: string; message: string; raw: unknown }
  | { status: "error"; provider: string; message: string; raw?: unknown };

export const requestCompanyVisuraPdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        vat: z.string().trim().min(8).max(20).refine((v) => VAT_REGEX.test(v), {
          message: "Formato Partita IVA non valido",
        }),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<VisuraPdfResult> => {
    const token = process.env.OPENAPI_COMPANY_TOKEN ?? process.env.OPENAPI_VAT_TOKEN;
    if (!token) {
      return { status: "error", provider: "openapi", message: "Token OpenAPI non configurato." };
    }
    const cleanVat = data.vat.toUpperCase().replace(/^IT/, "");

    // Tentativi: prima il servizio Visure, poi IT-full come fallback.
    const attempts = [
      { url: `https://visure.openapi.com/IT-richiestavisura`, method: "POST" as const, body: { cf_piva: cleanVat } },
      { url: `https://visure.openapi.com/IT-richiestavisuraordinaria`, method: "POST" as const, body: { cf_piva: cleanVat } },
      { url: `https://company.openapi.com/IT-full/${encodeURIComponent(cleanVat)}`, method: "GET" as const },
    ];

    let lastError = "Servizio non disponibile";
    let lastRaw: unknown = null;
    for (const a of attempts) {
      try {
        const res = await fetch(a.url, {
          method: a.method,
          headers: {
            Authorization: `Bearer ${token.trim()}`,
            Accept: "application/json",
            ...(a.method === "POST" ? { "Content-Type": "application/json" } : {}),
          },
          ...(a.method === "POST" ? { body: JSON.stringify(a.body) } : {}),
        });
        const text = await res.text();
        let json: unknown = text;
        try { json = JSON.parse(text); } catch { /* not JSON */ }
        lastRaw = json;

        if (res.status === 401 || res.status === 403) {
          lastError = `Pacchetto Visure non attivo (${res.status}). Attivalo su OpenAPI per scaricare la visura PDF.`;
          continue;
        }
        if (res.status === 404) { lastError = "Endpoint non disponibile (404)."; continue; }
        if (!res.ok) {
          lastError = `OpenAPI ${res.status}: ${typeof text === "string" ? text.slice(0, 200) : res.statusText}`;
          continue;
        }

        // Cerca un URL di download nella risposta
        const j = json as Record<string, unknown>;
        const downloadUrl =
          (asString(get(j, "data.file.url")) as string | null) ??
          (asString(get(j, "data.url")) as string | null) ??
          (asString(get(j, "data.pdf_url")) as string | null) ??
          (asString(get(j, "url")) as string | null);
        if (downloadUrl) {
          return { status: "success", provider: "openapi", downloadUrl, raw: json };
        }
        const requestId =
          asString(get(j, "data.id")) ?? asString(get(j, "id")) ?? asString(get(j, "data.request_id"));
        if (requestId) {
          return {
            status: "pending",
            provider: "openapi",
            requestId,
            message: "Richiesta accettata. La visura sarà disponibile a breve.",
            raw: json,
          };
        }
        // Risposta OK ma senza URL → ritorna comunque per ispezione
        return {
          status: "error",
          provider: "openapi",
          message: "Risposta ricevuta ma senza link di download. Verifica i dettagli in console.",
          raw: json,
        };
      } catch (err) {
        lastError = err instanceof Error ? err.message : "Errore di rete";
      }
    }

    return { status: "error", provider: "openapi", message: lastError, raw: lastRaw };
  });
