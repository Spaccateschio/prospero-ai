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
    }
  | { status: "not_found"; provider: string; message: string }
  | { status: "error"; provider: string; message: string };

// -----------------------------------------------------------------------------
// Provider implementations (server-only)
// -----------------------------------------------------------------------------

interface VatProvider {
  readonly name: string;
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
  constructor(private token: string) {}

  async lookup(vat: string): Promise<VatLookupResult> {
    try {
      const url = `https://imprese.openapi.com/advance/${encodeURIComponent(vat)}`;
      const res = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.token}`,
          Accept: "application/json",
        },
      });

      if (res.status === 404) {
        return { status: "not_found", provider: this.name, message: "Partita IVA non trovata" };
      }
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        return {
          status: "error",
          provider: this.name,
          message: `OpenAPI ${res.status}: ${text.slice(0, 200) || res.statusText}`,
        };
      }

      const json = (await res.json()) as Record<string, unknown>;
      const mapped = mapOpenApiPayload(vat, json);
      if (!mapped) {
        return { status: "not_found", provider: this.name, message: "Risposta vuota" };
      }
      return {
        status: "success",
        provider: this.name,
        data: mapped,
        verifiedFields: verifiedFieldsOf(mapped),
      };
    } catch (err) {
      return {
        status: "error",
        provider: this.name,
        message: err instanceof Error ? err.message : "Errore di rete",
      };
    }
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
  const openApi = process.env.OPENAPI_VAT_TOKEN;
  if (openApi && openApi.trim().length > 0) return new OpenApiProvider(openApi.trim());
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

function mapOpenApiPayload(vat: string, payload: Record<string, unknown>): NormalizedCompanyData | null {
  // Le risposte OpenAPI tipicamente hanno { success, message, data: { ... } }
  // o { data: [ { ... } ] }. Gestiamo entrambe.
  const dataRaw = (payload.data ?? payload) as unknown;
  const root = Array.isArray(dataRaw) ? (dataRaw[0] as Record<string, unknown> | undefined) : (dataRaw as Record<string, unknown>);
  if (!root || typeof root !== "object") return null;

  const address = (root.address ?? root.indirizzo ?? root.sede_legale ?? {}) as Record<string, unknown>;
  const ateco = (root.ateco ?? root.activity_code ?? {}) as Record<string, unknown>;

  return {
    vat,
    fiscal_code: pickString(root.tax_code, root.codice_fiscale, root.cf),
    legal_name: pickString(root.company_name, root.denomination, root.denominazione, root.ragione_sociale),
    legal_form: pickString(root.company_type, root.legal_form, root.forma_giuridica),
    pec_email: pickString(root.pec, root.pec_email, pickPath(root, "contacts.pec")),
    sdi_code: pickString(root.sdi_code, root.codice_destinatario, root.sdi),
    rea_code: pickString(root.rea, root.rea_code, pickPath(root, "rea.code")),
    chamber_of_commerce: pickString(root.cciaa, root.chamber_of_commerce, pickPath(root, "rea.chamber")),
    ateco: pickString(ateco.code, root.ateco_code, root.codice_ateco),
    ateco_description: pickString(ateco.description, root.ateco_description, root.descrizione_ateco),
    activity_status: pickString(root.status, root.activity_status, root.stato_attivita),
    activity_start_date: pickString(
      root.activity_start, root.activity_start_date, root.data_inizio_attivita, root.start_date,
    ),
    legal_address_street: pickString(address.street, address.toponym, address.via, address.indirizzo),
    city: pickString(address.city, address.town, address.comune),
    province: pickString(address.province, address.provincia, address.prov),
    region: pickString(address.region, address.regione),
    zip_code: pickString(address.zip_code, address.postcode, address.cap),
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
