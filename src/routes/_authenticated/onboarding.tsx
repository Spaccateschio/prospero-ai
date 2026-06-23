import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Check, ChevronLeft, ChevronRight, Loader2, Wallet } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useActiveCompany, useCreateCompany } from "@/hooks/use-companies";
import { useProfile } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/onboarding")({
  component: OnboardingWizard,
});

const ITALIAN_REGIONS = [
  "Abruzzo", "Basilicata", "Calabria", "Campania", "Emilia-Romagna", "Friuli-Venezia Giulia",
  "Lazio", "Liguria", "Lombardia", "Marche", "Molise", "Piemonte", "Puglia", "Sardegna",
  "Sicilia", "Toscana", "Trentino-Alto Adige", "Umbria", "Valle d'Aosta", "Veneto",
];

const COMPANY_TYPES: { value: string; label: string }[] = [
  { value: "srl", label: "S.r.l." },
  { value: "srls", label: "S.r.l.s." },
  { value: "spa", label: "S.p.A." },
  { value: "sapa", label: "S.a.p.A." },
  { value: "snc", label: "S.n.c." },
  { value: "sas", label: "S.a.s." },
  { value: "ditta_individuale", label: "Ditta individuale" },
  { value: "cooperativa", label: "Cooperativa" },
  { value: "altro", label: "Altro" },
];

const ISO_OPTIONS = [
  { id: "iso_9001", label: "ISO 9001 — Qualità" },
  { id: "iso_14001", label: "ISO 14001 — Ambiente" },
  { id: "iso_45001", label: "ISO 45001 — Salute e sicurezza" },
  { id: "iso_50001", label: "ISO 50001 — Energia" },
  { id: "iso_27001", label: "ISO 27001 — Sicurezza informazioni" },
];

const step1Schema = z.object({
  name: z.string().trim().min(2, "Obbligatorio").max(120),
  legal_name: z.string().trim().max(160).optional().or(z.literal("")),
  vat: z.string().trim().max(20).optional().or(z.literal("")),
  ateco: z.string().trim().max(10).optional().or(z.literal("")),
  sector: z.string().trim().max(80).optional().or(z.literal("")),
  region: z.string().optional(),
  province: z.string().trim().max(60).optional().or(z.literal("")),
  city: z.string().trim().max(80).optional().or(z.literal("")),
  regime_fiscale: z.enum(["ordinario", "semplificato", "forfettario", "agricolo"]).optional(),
  company_type: z
    .enum(["srl", "srls", "spa", "sapa", "snc", "sas", "ditta_individuale", "cooperativa", "altro"])
    .optional(),
});

const step2Schema = z.object({
  employees_count: z.coerce.number().int().min(0).max(100000).optional(),
  annual_revenue: z.coerce.number().min(0).max(1_000_000_000_000).optional(),
  founded_year: z.coerce.number().int().min(1800).max(new Date().getFullYear()).optional(),
  iso_certifications: z.array(z.string()).optional(),
});

const step6Schema = z.object({
  iva_frequency: z.enum(["mensile", "trimestrale", "annuale"]),
});

type Step1Values = z.infer<typeof step1Schema>;
type Step2Values = z.infer<typeof step2Schema>;
type Step6Values = z.infer<typeof step6Schema>;

type WizardData = Partial<Step1Values> &
  Partial<Step2Values> & { iva_frequency?: "mensile" | "trimestrale" | "annuale" };

const STEPS = [
  { id: 1, title: "Crea azienda", description: "Dati anagrafici e fiscali principali" },
  { id: 2, title: "Profilo bandi & ESG", description: "Dipendenti, fatturato, certificazioni" },
  { id: 3, title: "Conto bancario", description: "Connessione bancaria (opzionale)" },
  { id: 4, title: "Primi documenti", description: "Importa fatture o bilanci (opzionale)" },
  { id: 5, title: "Invita commercialista", description: "Aggiungi il tuo consulente (opzionale)" },
  { id: 6, title: "Regime IVA", description: "Frequenza adempimenti IVA" },
  { id: 7, title: "Tutto pronto", description: "Benvenuto in CFO AI" },
];

function OnboardingWizard() {
  const navigate = useNavigate();
  const { companies, isLoading } = useActiveCompany();
  const [step, setStep] = useState(1);
  const [data, setData] = useState<WizardData>({ iso_certifications: [] });
  const [createdCompanyId, setCreatedCompanyId] = useState<string | null>(null);
  const createCompany = useCreateCompany();

  // Se c'è già un'azienda e l'utente non l'ha appena creata, vai alla dashboard
  useEffect(() => {
    if (!isLoading && companies.length > 0 && !createdCompanyId) {
      navigate({ to: "/dashboard", replace: true });
    }
  }, [isLoading, companies.length, createdCompanyId, navigate]);

  async function finalize() {
    if (!createdCompanyId) return;
    const { error } = await supabase
      .from("profiles")
      .update({ onboarding_completed: true })
      .eq("id", (await supabase.auth.getUser()).data.user!.id);
    if (error) {
      toast.error("Errore", { description: error.message });
      return;
    }
    toast.success("Setup completato!");
    navigate({ to: "/dashboard", replace: true });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-6 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Wallet className="h-4 w-4" />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold">CFO AI</div>
            <div className="text-[11px] text-muted-foreground">Configurazione iniziale</div>
          </div>
          <div className="ml-auto text-xs text-muted-foreground">
            Passo {step} di {STEPS.length}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-6 py-8">
        <Progress value={(step / STEPS.length) * 100} className="mb-8 h-1.5" />

        <div className="grid gap-8 md:grid-cols-[220px_1fr]">
          <ol className="space-y-3 text-sm">
            {STEPS.map((s) => (
              <li
                key={s.id}
                className={cn(
                  "flex gap-3 rounded-md p-2",
                  step === s.id && "bg-accent text-accent-foreground",
                )}
              >
                <div
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs",
                    s.id < step
                      ? "border-primary bg-primary text-primary-foreground"
                      : step === s.id
                      ? "border-primary text-primary"
                      : "border-muted text-muted-foreground",
                  )}
                >
                  {s.id < step ? <Check className="h-3 w-3" /> : s.id}
                </div>
                <div className="leading-tight">
                  <div className="font-medium">{s.title}</div>
                  <div className="text-xs text-muted-foreground">{s.description}</div>
                </div>
              </li>
            ))}
          </ol>

          <div>
            {step === 1 && (
              <Step1
                defaults={data}
                onNext={async (values) => {
                  setData((d) => ({ ...d, ...values }));
                  setStep(2);
                }}
              />
            )}
            {step === 2 && (
              <Step2
                defaults={data}
                onBack={() => setStep(1)}
                pending={createCompany.isPending}
                onNext={async (values) => {
                  const merged = { ...data, ...values };
                  setData(merged);
                  // Crea l'azienda alla fine dello step 2
                  try {
                    const company = await createCompany.mutateAsync({
                      name: merged.name!,
                      legal_name: merged.legal_name || undefined,
                      vat: merged.vat || undefined,
                      ateco: merged.ateco || undefined,
                      sector: merged.sector || undefined,
                      region: merged.region || undefined,
                      province: merged.province || undefined,
                      city: merged.city || undefined,
                      regime_fiscale: merged.regime_fiscale,
                      company_type: merged.company_type,
                      founded_year: merged.founded_year,
                      employees_count: merged.employees_count,
                      annual_revenue: merged.annual_revenue,
                      iso_certifications: merged.iso_certifications ?? [],
                    });
                    setCreatedCompanyId(company.id);
                    setStep(3);
                  } catch (err) {
                    toast.error("Errore creazione azienda", {
                      description: err instanceof Error ? err.message : "Imprevisto",
                    });
                  }
                }}
              />
            )}
            {step === 3 && <SkipStep title="Connetti il tuo conto bancario" body="Tramite Open Banking potrai sincronizzare automaticamente le movimentazioni. Lo configurerai più avanti dalle impostazioni." onBack={() => setStep(2)} onNext={() => setStep(4)} />}
            {step === 4 && <SkipStep title="Importa i primi documenti" body="Potrai caricare fatture elettroniche, bilanci o estratti conto. Lo farai dal modulo Contabilità o Bilanci Storici." onBack={() => setStep(3)} onNext={() => setStep(5)} />}
            {step === 5 && <SkipStep title="Invita il tuo commercialista" body="Potrai aggiungerlo dalle Impostazioni con un permesso configurabile e log di audit." onBack={() => setStep(4)} onNext={() => setStep(6)} />}
            {step === 6 && (
              <Step6
                defaults={data}
                onBack={() => setStep(5)}
                onNext={async (values) => {
                  // Salva regime IVA sull'azienda creata
                  if (createdCompanyId) {
                    const { error } = await supabase
                      .from("companies")
                      .update({ iva_frequency: values.iva_frequency })
                      .eq("id", createdCompanyId);
                    if (error) {
                      toast.error("Errore", { description: error.message });
                      return;
                    }
                  }
                  setData((d) => ({ ...d, ...values }));
                  setStep(7);
                }}
              />
            )}
            {step === 7 && (
              <Card>
                <CardHeader>
                  <CardTitle>Tutto pronto!</CardTitle>
                  <CardDescription>
                    La tua azienda è configurata. Ora puoi iniziare ad esplorare la dashboard,
                    importare i tuoi dati e personalizzare i widget.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button onClick={finalize} className="w-full">Entra nella dashboard</Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StepShell({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function SkipStep({ title, body, onBack, onNext }: { title: string; body: string; onBack: () => void; onNext: () => void }) {
  return (
    <StepShell title={title} description="Puoi saltare e configurarlo dopo">
      <p className="mb-6 text-sm text-muted-foreground">{body}</p>
      <div className="flex justify-between gap-2">
        <Button variant="ghost" onClick={onBack}><ChevronLeft className="mr-1 h-4 w-4" /> Indietro</Button>
        <Button onClick={onNext}>Salta e continua <ChevronRight className="ml-1 h-4 w-4" /></Button>
      </div>
    </StepShell>
  );
}

function Step1({ defaults, onNext }: { defaults: WizardData; onNext: (v: z.infer<typeof step1Schema>) => void }) {
  const form = useForm<z.infer<typeof step1Schema>>({
    resolver: zodResolver(step1Schema),
    defaultValues: {
      name: defaults.name ?? "",
      legal_name: defaults.legal_name ?? "",
      vat: defaults.vat ?? "",
      ateco: defaults.ateco ?? "",
      sector: defaults.sector ?? "",
      region: defaults.region,
      province: defaults.province ?? "",
      city: defaults.city ?? "",
      regime_fiscale: defaults.regime_fiscale,
      company_type: defaults.company_type,
    },
  });

  return (
    <StepShell title="Crea la tua azienda" description="Inserisci i dati principali. Potrai modificarli in qualsiasi momento dalle Impostazioni.">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onNext)} className="grid gap-4 sm:grid-cols-2">
          <FormField control={form.control} name="name" render={({ field }) => (
            <FormItem className="sm:col-span-2">
              <FormLabel>Nome azienda *</FormLabel>
              <FormControl><Input placeholder="Mario Rossi SRL" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="legal_name" render={({ field }) => (
            <FormItem>
              <FormLabel>Ragione sociale</FormLabel>
              <FormControl><Input placeholder="Mario Rossi Società a responsabilità limitata" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="company_type" render={({ field }) => (
            <FormItem>
              <FormLabel>Tipo società</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl><SelectTrigger><SelectValue placeholder="Seleziona..." /></SelectTrigger></FormControl>
                <SelectContent>
                  {COMPANY_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="vat" render={({ field }) => (
            <FormItem>
              <FormLabel>Partita IVA</FormLabel>
              <FormControl><Input placeholder="12345678901" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="ateco" render={({ field }) => (
            <FormItem>
              <FormLabel>Codice ATECO</FormLabel>
              <FormControl><Input placeholder="62.01.00" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="sector" render={({ field }) => (
            <FormItem className="sm:col-span-2">
              <FormLabel>Settore</FormLabel>
              <FormControl><Input placeholder="Servizi IT, Ristorazione, Edilizia..." {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="region" render={({ field }) => (
            <FormItem>
              <FormLabel>Regione</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl><SelectTrigger><SelectValue placeholder="Seleziona..." /></SelectTrigger></FormControl>
                <SelectContent>
                  {ITALIAN_REGIONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="province" render={({ field }) => (
            <FormItem>
              <FormLabel>Provincia</FormLabel>
              <FormControl><Input placeholder="MI" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="city" render={({ field }) => (
            <FormItem>
              <FormLabel>Città</FormLabel>
              <FormControl><Input placeholder="Milano" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="regime_fiscale" render={({ field }) => (
            <FormItem>
              <FormLabel>Regime fiscale</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl><SelectTrigger><SelectValue placeholder="Seleziona..." /></SelectTrigger></FormControl>
                <SelectContent>
                  <SelectItem value="ordinario">Ordinario</SelectItem>
                  <SelectItem value="semplificato">Semplificato</SelectItem>
                  <SelectItem value="forfettario">Forfettario</SelectItem>
                  <SelectItem value="agricolo">Agricolo</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />

          <div className="sm:col-span-2 flex justify-end">
            <Button type="submit">Continua <ChevronRight className="ml-1 h-4 w-4" /></Button>
          </div>
        </form>
      </Form>
    </StepShell>
  );
}

function Step2({ defaults, pending, onBack, onNext }: { defaults: WizardData; pending: boolean; onBack: () => void; onNext: (v: z.infer<typeof step2Schema>) => void }) {
  const form = useForm<z.infer<typeof step2Schema>>({
    resolver: zodResolver(step2Schema),
    defaultValues: {
      employees_count: defaults.employees_count,
      annual_revenue: defaults.annual_revenue,
      founded_year: defaults.founded_year,
      iso_certifications: defaults.iso_certifications ?? [],
    },
  });

  return (
    <StepShell title="Profilo per bandi e ESG" description="Useremo questi dati per filtrare bandi e incentivi a cui sei idoneo e per stimare la tua impronta carbonica.">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onNext)} className="grid gap-4 sm:grid-cols-3">
          <FormField control={form.control} name="employees_count" render={({ field }) => (
            <FormItem>
              <FormLabel>Dipendenti</FormLabel>
              <FormControl><Input type="number" min={0} {...field} value={field.value ?? ""} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="annual_revenue" render={({ field }) => (
            <FormItem>
              <FormLabel>Fatturato annuo (€)</FormLabel>
              <FormControl><Input type="number" min={0} step="1000" {...field} value={field.value ?? ""} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="founded_year" render={({ field }) => (
            <FormItem>
              <FormLabel>Anno fondazione</FormLabel>
              <FormControl><Input type="number" min={1800} max={new Date().getFullYear()} {...field} value={field.value ?? ""} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="iso_certifications" render={() => (
            <FormItem className="sm:col-span-3">
              <FormLabel>Certificazioni ISO</FormLabel>
              <FormDescription>Spunta quelle attive — incidono sull'idoneità ai bandi.</FormDescription>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {ISO_OPTIONS.map((opt) => (
                  <FormField key={opt.id} control={form.control} name="iso_certifications" render={({ field }) => {
                    const checked = field.value?.includes(opt.id) ?? false;
                    return (
                      <FormItem className="flex items-center gap-2 rounded-md border p-2">
                        <FormControl>
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(v) => {
                              const next = new Set(field.value ?? []);
                              if (v) next.add(opt.id); else next.delete(opt.id);
                              field.onChange(Array.from(next));
                            }}
                          />
                        </FormControl>
                        <FormLabel className="cursor-pointer text-sm font-normal">{opt.label}</FormLabel>
                      </FormItem>
                    );
                  }} />
                ))}
              </div>
              <FormMessage />
            </FormItem>
          )} />

          <div className="sm:col-span-3 flex justify-between">
            <Button type="button" variant="ghost" onClick={onBack}><ChevronLeft className="mr-1 h-4 w-4" /> Indietro</Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Crea azienda e continua <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </form>
      </Form>
    </StepShell>
  );
}

function Step6({ defaults, onBack, onNext }: { defaults: WizardData; onBack: () => void; onNext: (v: z.infer<typeof step6Schema>) => void }) {
  const form = useForm<z.infer<typeof step6Schema>>({
    resolver: zodResolver(step6Schema),
    defaultValues: { iva_frequency: defaults.iva_frequency ?? "trimestrale" },
  });

  return (
    <StepShell title="Regime IVA" description="Frequenza con cui presenti la liquidazione IVA — useremo questa info per generare il calendario fiscale.">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onNext)} className="space-y-4">
          <FormField control={form.control} name="iva_frequency" render={({ field }) => (
            <FormItem>
              <FormLabel>Frequenza liquidazione IVA</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>
                  <SelectItem value="mensile">Mensile</SelectItem>
                  <SelectItem value="trimestrale">Trimestrale</SelectItem>
                  <SelectItem value="annuale">Annuale</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />

          <div className="flex justify-between">
            <Button type="button" variant="ghost" onClick={onBack}><ChevronLeft className="mr-1 h-4 w-4" /> Indietro</Button>
            <Button type="submit">Continua <ChevronRight className="ml-1 h-4 w-4" /></Button>
          </div>
        </form>
      </Form>
    </StepShell>
  );
}

// Avoid unused import warning if useProfile not used; intentionally referenced for future:
void useProfile;
