import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Database, Loader2, RefreshCw, Save, Settings as SettingsIcon, ShieldAlert, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import { useActiveCompany } from "@/hooks/use-companies";
import {
  AnagraficaForm, emptyAnagrafica,
  type AnagraficaValues, type FieldSources,
} from "@/components/company/anagrafica-form";
import { DocumentsSection } from "@/components/company/documents-section";
import { getCompanyAnagrafica, saveCompanyAnagrafica } from "@/lib/anagrafica.functions";
import { clearDemoData, countDemoData, seedDemoData } from "@/lib/dashboard.functions";

export const Route = createFileRoute("/_authenticated/_app/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { activeId, active, isLoading } = useActiveCompany();

  if (isLoading) {
    return <div className="flex items-center justify-center p-12 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /></div>;
  }
  if (!activeId || !active) {
    return (
      <div className="p-6">
        <Alert>
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Nessuna azienda selezionata</AlertTitle>
          <AlertDescription>Crea o seleziona un'azienda per accedere alle impostazioni.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <header className="flex items-center gap-3">
        <SettingsIcon className="h-5 w-5 text-muted-foreground" />
        <div>
          <h1 className="text-xl font-semibold">Impostazioni</h1>
          <p className="text-sm text-muted-foreground">Configurazione di {active.company.name}</p>
        </div>
      </header>

      <Tabs defaultValue="anagrafica" className="w-full">
        <TabsList>
          <TabsTrigger value="anagrafica">Anagrafica azienda</TabsTrigger>
          <TabsTrigger value="documents">Documenti</TabsTrigger>
          <TabsTrigger value="demo">Dati di prova</TabsTrigger>
          <TabsTrigger value="integrations">Integrazioni</TabsTrigger>
        </TabsList>

        <TabsContent value="anagrafica" className="mt-6">
          <AnagraficaTab companyId={activeId} />
        </TabsContent>
        <TabsContent value="documents" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Documenti aziendali</CardTitle>
              <CardDescription>Visure camerali, bilanci depositati, atti societari.</CardDescription>
            </CardHeader>
            <CardContent>
              <DocumentsSection companyId={activeId} />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="demo" className="mt-6">
          <DemoDataTab companyId={activeId} />
        </TabsContent>
        <TabsContent value="integrations" className="mt-6">
          <IntegrationsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function DemoDataTab({ companyId }: { companyId: string }) {
  const queryClient = useQueryClient();
  const fetchCount = useServerFn(countDemoData);
  const seedFn = useServerFn(seedDemoData);
  const clearFn = useServerFn(clearDemoData);

  const countQuery = useQuery({
    queryKey: ["demo-count", companyId],
    queryFn: () => fetchCount({ data: { company_id: companyId } }),
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["demo-count", companyId] });
    queryClient.invalidateQueries({ queryKey: ["transactions", companyId] });
    queryClient.invalidateQueries({ queryKey: ["cashflow-summary", companyId] });
    queryClient.invalidateQueries({ queryKey: ["forecast", companyId] });
    queryClient.invalidateQueries({ queryKey: ["dashboard-kpis", companyId] });
    queryClient.invalidateQueries({ queryKey: ["top-expense-cat", companyId] });
  };

  const seed = useMutation({
    mutationFn: () => seedFn({ data: { company_id: companyId } }),
    onSuccess: (r) => {
      toast.success(`Dati demo caricati: ${r.transactions} movimenti, ${r.invoices} fatture`);
      invalidateAll();
    },
    onError: (err) => toast.error("Caricamento fallito", { description: err instanceof Error ? err.message : "" }),
  });

  const clear = useMutation({
    mutationFn: () => clearFn({ data: { company_id: companyId } }),
    onSuccess: () => {
      toast.success("Dati demo rimossi");
      invalidateAll();
    },
    onError: (err) => toast.error("Rimozione fallita", { description: err instanceof Error ? err.message : "" }),
  });

  const hasDemo = (countQuery.data?.transactions ?? 0) + (countQuery.data?.invoices ?? 0) > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Database className="h-4 w-4" /> Dati di prova</CardTitle>
        <CardDescription>
          Popola velocemente dashboard e cash flow con dati realistici per esplorare l'app.
          I dati sono marcati come "demo" e possono essere rimossi in qualsiasi momento senza toccare i tuoi dati reali.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border p-4 text-sm">
          <div className="font-medium mb-1">Stato attuale</div>
          {countQuery.isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : hasDemo ? (
            <p className="text-muted-foreground">
              {countQuery.data?.transactions ?? 0} movimenti demo e {countQuery.data?.invoices ?? 0} fatture demo presenti.
            </p>
          ) : (
            <p className="text-muted-foreground">Nessun dato demo presente.</p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => seed.mutate()} disabled={seed.isPending}>
            {seed.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            {hasDemo ? "Ricarica dati demo" : "Carica dati demo"}
          </Button>
          {hasDemo && (
            <Button variant="outline" onClick={() => clear.mutate()} disabled={clear.isPending}>
              {clear.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              Rimuovi dati demo
            </Button>
          )}
        </div>

        <Alert>
          <AlertTitle className="text-xs">Cosa viene generato</AlertTitle>
          <AlertDescription className="text-xs">
            6 mesi di entrate (vendite, servizi) e uscite (affitto, stipendi, fornitori, utenze) realistiche,
            2 ricorrenze mensili (affitto e stipendi), 1 movimento previsionale a 20 giorni, 2 fatture aperte demo.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}

function AnagraficaTab({ companyId }: { companyId: string }) {
  const queryClient = useQueryClient();
  const fetchAnagrafica = useServerFn(getCompanyAnagrafica);
  const saveAnagrafica = useServerFn(saveCompanyAnagrafica);

  const query = useQuery({
    queryKey: ["company-anagrafica", companyId],
    queryFn: () => fetchAnagrafica({ data: { company_id: companyId } }),
  });

  const [values, setValues] = useState<AnagraficaValues>(emptyAnagrafica());
  const [sources, setSources] = useState<FieldSources>({});
  const [provider, setProvider] = useState<string | null>(null);

  useEffect(() => {
    if (!query.data) return;
    const c = query.data.company as Record<string, unknown>;
    setValues(emptyAnagrafica({
      name: (c.name as string) ?? "",
      legal_name: (c.legal_name as string) ?? "",
      legal_form: (c.legal_form as string) ?? "",
      vat: (c.vat as string) ?? "",
      fiscal_code: (c.fiscal_code as string) ?? "",
      company_type: (c.company_type as AnagraficaValues["company_type"]) ?? "",
      ateco: (c.ateco as string) ?? "",
      ateco_description: (c.ateco_description as string) ?? "",
      sector: (c.sector as string) ?? "",
      pec_email: (c.pec_email as string) ?? "",
      sdi_code: (c.sdi_code as string) ?? "",
      rea_code: (c.rea_code as string) ?? "",
      chamber_of_commerce: (c.chamber_of_commerce as string) ?? "",
      activity_status: (c.activity_status as string) ?? "",
      activity_start_date: (c.activity_start_date as string) ?? "",
      legal_address_street: (c.legal_address_street as string) ?? "",
      city: (c.city as string) ?? "",
      province: (c.province as string) ?? "",
      region: (c.region as string) ?? "",
      zip_code: (c.zip_code as string) ?? "",
    }));
    const next: FieldSources = {};
    for (const [field, info] of Object.entries(query.data.sources)) {
      next[field as keyof AnagraficaValues] = info.source as FieldSources[keyof FieldSources];
    }
    setSources(next);
    setProvider((c.verification_provider as string) ?? null);
  }, [query.data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      await saveAnagrafica({
        data: {
          company_id: companyId,
          values: {
            ...values,
            company_type: values.company_type || undefined,
          },
          sources,
          provider: provider ?? undefined,
          mark_verified: Object.values(sources).some((s) => s === "external"),
        },
      });
    },
    onSuccess: () => {
      toast.success("Anagrafica salvata");
      queryClient.invalidateQueries({ queryKey: ["company-anagrafica", companyId] });
      queryClient.invalidateQueries({ queryKey: ["companies"] });
    },
    onError: (err) => toast.error("Salvataggio fallito", { description: err instanceof Error ? err.message : "" }),
  });

  if (query.isLoading) {
    return <div className="flex items-center justify-center p-12 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /></div>;
  }

  const c = query.data?.company as Record<string, unknown> | undefined;
  const lastVerifiedAt = c?.last_verified_at as string | undefined;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>Anagrafica azienda</CardTitle>
            <CardDescription>
              Dati anagrafici, sede legale e classificazione. I campi con badge{" "}
              <span className="inline-flex items-center gap-1 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] text-emerald-300">
                <CheckCircle2 className="h-2.5 w-2.5" /> Verificato
              </span>{" "}
              provengono da una fonte esterna. Modificandoli, tornano a "inseriti dall'utente".
            </CardDescription>
          </div>
          {lastVerifiedAt && (
            <div className="text-right text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <RefreshCw className="h-3 w-3" />
                Ultima verifica {formatDistanceToNow(new Date(lastVerifiedAt), { addSuffix: true, locale: it })}
              </div>
              {provider && <div className="mt-0.5">via {provider}</div>}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <AnagraficaForm
          values={values}
          sources={sources}
          onChange={(v, s) => { setValues(v); setSources(s); }}
          onVerified={(p) => setProvider(p)}
        />
        <div className="flex justify-end">
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !values.name}>
            {saveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Salva anagrafica
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function IntegrationsTab() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Integrazioni dati ufficiali</CardTitle>
        <CardDescription>
          Provider esterni per arricchimento anagrafica, visure camerali e bilanci depositati.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {[
          { name: "OpenAPI.com — IT-START", status: "Configurabile", desc: "Anagrafica completa da P.IVA: ragione sociale, sede, ATECO, REA, PEC, SDI, stato attività." },
          { name: "ACube", status: "Prossimamente", desc: "Visure camerali, bilanci, atti societari, fatturazione elettronica." },
          { name: "InfoCamere / Telemaco", status: "Prossimamente", desc: "Fonte ufficiale Registro Imprese. Richiede contratto." },
          { name: "Agenzia delle Entrate", status: "Prossimamente", desc: "Verifica anagrafica fiscale e regime IVA ufficiale." },
        ].map((p) => (
          <div key={p.name} className="flex items-start justify-between rounded-md border p-3">
            <div>
              <div className="text-sm font-medium">{p.name}</div>
              <div className="text-xs text-muted-foreground">{p.desc}</div>
            </div>
            <span className="rounded bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
              {p.status}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
