import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, ChevronDown, FileUp, Loader2, Search, ShieldAlert, UserPen } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

import { lookupVatNumber } from "@/lib/vat-lookup.functions";
import type { NormalizedCompanyData, VatLookupResult } from "@/lib/vat-lookup.functions";
import { extractVisuraData, type VisuraExtras } from "@/lib/visura-extraction.functions";

export type AnagraficaValues = {
  name: string;
  legal_name: string;
  legal_form: string;
  vat: string;
  fiscal_code: string;
  company_type: "" | "srl" | "srls" | "spa" | "sapa" | "snc" | "sas" | "ditta_individuale" | "cooperativa" | "altro";
  ateco: string;
  ateco_description: string;
  sector: string;
  pec_email: string;
  sdi_code: string;
  rea_code: string;
  chamber_of_commerce: string;
  activity_status: string;
  activity_start_date: string;
  legal_address_street: string;
  city: string;
  province: string;
  region: string;
  zip_code: string;
};

export type FieldSource = "user" | "external" | "document";
export type FieldSources = Partial<Record<keyof AnagraficaValues, FieldSource>>;

const COMPANY_TYPES = [
  { value: "srl", label: "S.r.l." },
  { value: "srls", label: "S.r.l.s." },
  { value: "spa", label: "S.p.A." },
  { value: "sapa", label: "S.a.p.A." },
  { value: "snc", label: "S.n.c." },
  { value: "sas", label: "S.a.s." },
  { value: "ditta_individuale", label: "Ditta individuale" },
  { value: "cooperativa", label: "Cooperativa" },
  { value: "altro", label: "Altro" },
] as const;

const ITALIAN_REGIONS = [
  "Abruzzo", "Basilicata", "Calabria", "Campania", "Emilia-Romagna", "Friuli-Venezia Giulia",
  "Lazio", "Liguria", "Lombardia", "Marche", "Molise", "Piemonte", "Puglia", "Sardegna",
  "Sicilia", "Toscana", "Trentino-Alto Adige", "Umbria", "Valle d'Aosta", "Veneto",
];

export function emptyAnagrafica(partial?: Partial<AnagraficaValues>): AnagraficaValues {
  return {
    name: "", legal_name: "", legal_form: "", vat: "", fiscal_code: "", company_type: "",
    ateco: "", ateco_description: "", sector: "",
    pec_email: "", sdi_code: "", rea_code: "", chamber_of_commerce: "",
    activity_status: "", activity_start_date: "",
    legal_address_street: "", city: "", province: "", region: "", zip_code: "",
    ...partial,
  };
}

function applyVerifiedData(
  current: AnagraficaValues,
  current_sources: FieldSources,
  payload: NormalizedCompanyData,
  source: FieldSource = "external",
): { values: AnagraficaValues; sources: FieldSources } {
  const merged: AnagraficaValues = { ...current };
  const sources: FieldSources = { ...current_sources };
  const setIf = (key: keyof AnagraficaValues, val: string | null | undefined) => {
    if (val && val.length > 0) {
      merged[key] = val as never;
      sources[key] = source;
    }
  };
  setIf("vat", payload.vat);
  setIf("fiscal_code", payload.fiscal_code);
  setIf("legal_name", payload.legal_name);
  setIf("legal_form", payload.legal_form);
  setIf("pec_email", payload.pec_email);
  setIf("sdi_code", payload.sdi_code);
  setIf("rea_code", payload.rea_code);
  setIf("chamber_of_commerce", payload.chamber_of_commerce);
  setIf("ateco", payload.ateco);
  setIf("ateco_description", payload.ateco_description);
  setIf("activity_status", payload.activity_status);
  setIf("activity_start_date", payload.activity_start_date);
  setIf("legal_address_street", payload.legal_address_street);
  setIf("city", payload.city);
  setIf("province", payload.province);
  setIf("region", payload.region);
  setIf("zip_code", payload.zip_code);
  if (!merged.name && payload.legal_name) {
    merged.name = payload.legal_name;
    sources.name = source;
  }
  return { values: merged, sources };
}

function SourceBadge({ source }: { source?: FieldSource }) {
  if (source === "external") {
    return (
      <Badge variant="secondary" className="ml-2 gap-1 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/20">
        <CheckCircle2 className="h-3 w-3" /> Verificato
      </Badge>
    );
  }
  if (source === "document") {
    return (
      <Badge variant="secondary" className="ml-2 gap-1">
        <UserPen className="h-3 w-3" /> Da documento
      </Badge>
    );
  }
  return null;
}

type FieldProps<K extends keyof AnagraficaValues> = {
  name: K;
  label: string;
  values: AnagraficaValues;
  sources: FieldSources;
  onChange: (name: K, value: AnagraficaValues[K]) => void;
  className?: string;
  placeholder?: string;
  type?: string;
};

function TextFieldWithSource<K extends keyof AnagraficaValues>(p: FieldProps<K>) {
  const source = p.sources[p.name];
  return (
    <div className={cn("space-y-1.5", p.className)}>
      <Label className="flex items-center text-xs">
        {p.label}
        <SourceBadge source={source} />
      </Label>
      <Input
        type={p.type ?? "text"}
        value={(p.values[p.name] as string) ?? ""}
        placeholder={p.placeholder}
        onChange={(e) => p.onChange(p.name, e.target.value as AnagraficaValues[K])}
        className={cn(source === "external" && "border-emerald-500/40")}
      />
    </div>
  );
}

export type AnagraficaFormProps = {
  values: AnagraficaValues;
  sources: FieldSources;
  onChange: (values: AnagraficaValues, sources: FieldSources) => void;
  onVerified?: (provider: string) => void;
  onExtras?: (extras: VisuraExtras) => void;
  /** Mostra solo i campi essenziali (per onboarding step rapido) */
  compact?: boolean;
};

export function AnagraficaForm({ values, sources, onChange, onVerified, onExtras, compact = false }: AnagraficaFormProps) {
  const lookup = useServerFn(lookupVatNumber);
  const extractVisura = useServerFn(extractVisuraData);
  const [verifying, setVerifying] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [lastResult, setLastResult] = useState<VatLookupResult | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function update<K extends keyof AnagraficaValues>(key: K, value: AnagraficaValues[K]) {
    const nextSources = { ...sources };
    if (nextSources[key] === "external") nextSources[key] = "user";
    else if (!nextSources[key] && value) nextSources[key] = "user";
    onChange({ ...values, [key]: value }, nextSources);
  }

  async function handleVerify() {
    const vat = (values.vat ?? "").trim();
    if (!vat || vat.length < 8) {
      toast.error("Inserisci una Partita IVA valida");
      return;
    }
    setVerifying(true);
    try {
      const result = await lookup({ data: { vat } });
      setLastResult(result);
      if (result.status === "success") {
        const { values: merged, sources: mergedSources } = applyVerifiedData(values, sources, result.data);
        onChange(merged, mergedSources);
        onVerified?.(result.provider);
        setAdvancedOpen(true);
        toast.success(`Dati compilati da ${result.provider}`, {
          description: `${result.verifiedFields.length} campi precompilati — rivedi i dati avanzati`,
        });
      } else if (result.status === "not_found") {
        toast.warning("Partita IVA non trovata", {
          description: "Puoi proseguire compilando manualmente i dati essenziali.",
        });
      } else {
        toast.error("Verifica non disponibile", {
          description: `${result.message} Puoi proseguire compilando manualmente.`,
        });
      }
    } catch (err) {
      toast.error("Verifica non disponibile", {
        description: err instanceof Error
          ? `${err.message} — puoi proseguire compilando manualmente.`
          : "Imprevisto — puoi proseguire compilando manualmente.",
      });
    } finally {
      setVerifying(false);
    }
  }

  function inferCompanyType(legalForm: string | null | undefined): AnagraficaValues["company_type"] | null {
    if (!legalForm) return null;
    const s = legalForm.toLowerCase();
    if (s.includes("s.r.l.s") || s.includes("srls") || s.includes("semplificata")) return "srls";
    if (s.includes("s.r.l") || s.includes("srl") || s.includes("responsabilita")) return "srl";
    if (s.includes("s.p.a") || s.includes("spa") || s.includes("per azioni")) return "spa";
    if (s.includes("s.a.p.a") || s.includes("sapa") || s.includes("accomandita per azioni")) return "sapa";
    if (s.includes("s.a.s") || s.includes("sas") || s.includes("accomandita semplice")) return "sas";
    if (s.includes("s.n.c") || s.includes("snc") || s.includes("nome collettivo")) return "snc";
    if (s.includes("cooperativa") || s.includes("coop")) return "cooperativa";
    if (s.includes("individuale") || s.includes("ditta")) return "ditta_individuale";
    return "altro";
  }

  async function handleVisuraUpload(file: File) {
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Formato non valido", { description: "Carica un PDF della visura camerale." });
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error("File troppo grande", { description: "Massimo 20 MB." });
      return;
    }
    setExtracting(true);
    try {
      const buf = await file.arrayBuffer();
      // base64 encoding sicuro per file binari
      let binary = "";
      const bytes = new Uint8Array(buf);
      const chunkSize = 0x8000;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunkSize)));
      }
      const pdf_base64 = btoa(binary);

      const result = await extractVisura({ data: { pdf_base64, filename: file.name } });
      if (result.status === "success") {
        const { values: merged, sources: mergedSources } = applyVerifiedData(values, sources, result.data, "document");
        // Inferisci company_type da legal_form
        const inferred = inferCompanyType(result.data.legal_form);
        if (inferred && !merged.company_type) {
          merged.company_type = inferred;
          mergedSources.company_type = "document";
        }
        onChange(merged, mergedSources);
        onVerified?.("visura camerale");
        onExtras?.(result.extras);
        setAdvancedOpen(true);
        const extraCount =
          (result.extras.founded_year != null ? 1 : 0) +
          (result.extras.employees_count != null ? 1 : 0) +
          (result.extras.iso_certifications.length > 0 ? 1 : 0);
        toast.success("Dati estratti dalla visura", {
          description: `${result.extractedFields.length} campi precompilati${extraCount > 0 ? ` (inclusi ${extraCount} per il passo successivo)` : ""} — rivedi prima di salvare.`,
        });
      } else {
        toast.error("Estrazione non riuscita", { description: result.message });
      }
    } catch (err) {
      toast.error("Errore lettura file", {
        description: err instanceof Error ? err.message : "Imprevisto durante il caricamento.",
      });
    } finally {
      setExtracting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-6">
      {/* Verifica P.IVA */}
      <div className="rounded-lg border bg-muted/30 p-4">
        <div className="mb-3">
          <h4 className="text-sm font-semibold">Verifica automatica (consigliata)</h4>
          <p className="text-xs text-muted-foreground">
            Inserisci la Partita IVA: compileremo automaticamente ragione sociale, sede, ATECO, PEC,
            REA e gli altri dati dal Registro Imprese.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1.5">
            <Label className="text-xs flex items-center">
              Partita IVA
              <SourceBadge source={sources.vat} />
            </Label>
            <Input
              placeholder="12345678901"
              value={values.vat}
              onChange={(e) => update("vat", e.target.value.replace(/\s/g, ""))}
            />
          </div>
          <Button type="button" onClick={handleVerify} disabled={verifying || !values.vat}>
            {verifying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
            Verifica e compila
          </Button>
        </div>

        {/* Upload visura camerale */}
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-md border border-dashed bg-background/40 p-3">
          <div className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Hai una visura camerale?</span> Caricala in PDF
            e l'AI compilerà i dati automaticamente (anche senza Partita IVA).
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleVisuraUpload(f);
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={extracting}
            onClick={() => fileInputRef.current?.click()}
          >
            {extracting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileUp className="mr-2 h-4 w-4" />}
            Carica visura (PDF)
          </Button>
        </div>

        {lastResult && lastResult.status !== "success" && (
          <Alert variant="default" className="mt-3 border-amber-500/30 bg-amber-500/10">
            <ShieldAlert className="h-4 w-4 text-amber-400" />
            <AlertTitle className="text-amber-300">Verifica automatica non riuscita</AlertTitle>
            <AlertDescription className="text-xs text-amber-200/80">
              Nessun problema: puoi proseguire compilando manualmente i campi essenziali qui sotto,
              oppure caricare la visura camerale qui sopra.
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* Campi essenziali — sempre visibili */}
      <div className="grid gap-4 sm:grid-cols-2">
        <TextFieldWithSource name="name" label="Nome commerciale *" values={values} sources={sources} onChange={update} placeholder="Mario Rossi SRL" className="sm:col-span-2" />
        <TextFieldWithSource name="legal_name" label="Ragione sociale" values={values} sources={sources} onChange={update} />

        <div className="space-y-1.5">
          <Label className="flex items-center text-xs">
            Forma giuridica *
            <SourceBadge source={sources.company_type ?? sources.legal_form} />
          </Label>
          <Select value={values.company_type || ""} onValueChange={(v) => update("company_type", (v as AnagraficaValues["company_type"]) || "")}>
            <SelectTrigger><SelectValue placeholder="Seleziona..." /></SelectTrigger>
            <SelectContent>
              {COMPANY_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label className="flex items-center text-xs">
            Regione *
            <SourceBadge source={sources.region} />
          </Label>
          <Select value={values.region} onValueChange={(v) => update("region", v)}>
            <SelectTrigger><SelectValue placeholder="Seleziona..." /></SelectTrigger>
            <SelectContent>
              {ITALIAN_REGIONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Dati avanzati — collassabili */}
      {!compact && (
        <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
          <CollapsibleTrigger asChild>
            <Button type="button" variant="outline" className="w-full justify-between">
              <span className="text-sm">
                Dati avanzati (opzionali)
                <span className="ml-2 text-xs text-muted-foreground">
                  CF, ATECO, sede legale, PEC/SDI, REA
                </span>
              </span>
              <ChevronDown className={cn("h-4 w-4 transition-transform", advancedOpen && "rotate-180")} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-4 space-y-6">
            <div>
              <h4 className="mb-3 text-sm font-semibold">Identificativi fiscali</h4>
              <div className="grid gap-4 sm:grid-cols-2">
                <TextFieldWithSource name="fiscal_code" label="Codice fiscale azienda" values={values} sources={sources} onChange={update} />
                <TextFieldWithSource name="legal_form" label="Forma giuridica (testuale)" values={values} sources={sources} onChange={update} placeholder="es. SOCIETA' A RESPONSABILITA' LIMITATA" />
              </div>
            </div>

            <div>
              <h4 className="mb-3 text-sm font-semibold">Attività e classificazione</h4>
              <div className="grid gap-4 sm:grid-cols-2">
                <TextFieldWithSource name="ateco" label="Codice ATECO" values={values} sources={sources} onChange={update} placeholder="62.01.00" />
                <TextFieldWithSource name="sector" label="Settore" values={values} sources={sources} onChange={update} placeholder="Servizi IT" />
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="flex items-center text-xs">
                    Descrizione attività ATECO
                    <SourceBadge source={sources.ateco_description} />
                  </Label>
                  <Textarea
                    rows={2}
                    value={values.ateco_description}
                    onChange={(e) => update("ateco_description", e.target.value)}
                  />
                </div>
                <TextFieldWithSource name="activity_status" label="Stato attività" values={values} sources={sources} onChange={update} placeholder="ATTIVA" />
                <TextFieldWithSource name="activity_start_date" label="Data inizio attività" type="date" values={values} sources={sources} onChange={update} />
              </div>
            </div>

            <div>
              <h4 className="mb-3 text-sm font-semibold">Sede legale</h4>
              <div className="grid gap-4 sm:grid-cols-2">
                <TextFieldWithSource name="legal_address_street" label="Via / Indirizzo" values={values} sources={sources} onChange={update} className="sm:col-span-2" />
                <TextFieldWithSource name="city" label="Città" values={values} sources={sources} onChange={update} />
                <TextFieldWithSource name="zip_code" label="CAP" values={values} sources={sources} onChange={update} />
                <TextFieldWithSource name="province" label="Provincia" values={values} sources={sources} onChange={update} placeholder="MI" />
              </div>
            </div>

            <div>
              <h4 className="mb-3 text-sm font-semibold">Fatturazione elettronica e Camera di Commercio</h4>
              <div className="grid gap-4 sm:grid-cols-2">
                <TextFieldWithSource name="pec_email" label="PEC" values={values} sources={sources} onChange={update} placeholder="azienda@pec.it" />
                <TextFieldWithSource name="sdi_code" label="Codice destinatario SDI" values={values} sources={sources} onChange={update} placeholder="XXXXXXX" />
                <TextFieldWithSource name="rea_code" label="Codice REA" values={values} sources={sources} onChange={update} placeholder="MI-1234567" />
                <TextFieldWithSource name="chamber_of_commerce" label="Camera di Commercio" values={values} sources={sources} onChange={update} placeholder="Milano Monza Brianza Lodi" />
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
