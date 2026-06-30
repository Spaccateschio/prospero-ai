import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileBarChart2, Upload, Loader2, AlertCircle, Trash2, FileText, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

import { useActiveCompany } from "@/hooks/use-companies";
import { formatEUR } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import {
  extractBalanceData,
  saveBalanceSheet,
  listBalanceSheets,
  deleteBalanceSheet,
  type BalanceExtractedData,
  type BalanceMapped,
} from "@/lib/balance-extraction.functions";

export const Route = createFileRoute("/_authenticated/_app/balance-sheets")({
  component: BalanceSheetsPage,
});

const MAX_PDF_BYTES = 10 * 1024 * 1024;

type Extracted = BalanceExtractedData;

async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  // Base64 chunked encoding (evita stack overflow su file grandi)
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function numField(label: string, value: number | null, onChange: (v: number | null) => void) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input
        type="number"
        inputMode="decimal"
        step="0.01"
        value={value ?? ""}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === "" ? null : Number(v));
        }}
      />
    </div>
  );
}

function BalanceSheetsPage() {
  const queryClient = useQueryClient();
  const { activeId, active, isLoading } = useActiveCompany();
  const extractFn = useServerFn(extractBalanceData);
  const saveFn = useServerFn(saveBalanceSheet);
  const listFn = useServerFn(listBalanceSheets);
  const deleteFn = useServerFn(deleteBalanceSheet);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [extracting, setExtracting] = useState(false);
  const [draft, setDraft] = useState<Extracted | null>(null);
  const [draftMapped, setDraftMapped] = useState<BalanceMapped | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: sheets, isLoading: loadingList } = useQuery({
    queryKey: ["balance-sheets", activeId],
    queryFn: async () => (activeId ? await listFn({ data: { company_id: activeId } }) : []),
    enabled: !!activeId,
  });

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!activeId || !draft) throw new Error("Dati mancanti");
      let raw_file_url: string | null = null;
      if (pendingFile) {
        const path = `${activeId}/balance-sheets/${Date.now()}-${pendingFile.name.replace(/[^\w.-]/g, "_")}`;
        const { error: upErr } = await supabase.storage
          .from("company-documents")
          .upload(path, pendingFile, { contentType: "application/pdf", upsert: false });
        if (!upErr) raw_file_url = path;
      }
      // ricalcola gli aggregati partendo dal draft eventualmente modificato
      const ricavi = draft.ricavi;
      const ebitda =
        ricavi != null
          ? ricavi - (draft.costi_materie ?? 0) - (draft.costi_servizi ?? 0) - (draft.costi_personale ?? 0)
          : null;
      const debiti_totali =
        (draft.debiti_banche_breve ?? 0) +
          (draft.debiti_banche_lungo ?? 0) +
          (draft.debiti_fornitori ?? 0) +
          (draft.debiti_tributari ?? 0) +
          (draft.tfr ?? 0) || null;
      return await saveFn({
        data: {
          company_id: activeId,
          year: draft.year ?? new Date().getFullYear() - 1,
          extracted_data: draft as unknown as Record<string, unknown>,
          ricavi,
          ebitda,
          utile_netto: draft.utile_netto,
          patrimonio_netto: draft.patrimonio_netto,
          debiti_totali,
          liquidita: draft.liquidita,
          raw_file_url,
        },
      });
    },
    onSuccess: () => {
      toast.success("Bilancio salvato");
      queryClient.invalidateQueries({ queryKey: ["balance-sheets", activeId] });
      setDraft(null);
      setDraftMapped(null);
      setPendingFile(null);
    },
    onError: (e) => toast.error("Salvataggio fallito", { description: e instanceof Error ? e.message : "" }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      if (!activeId) return;
      await deleteFn({ data: { id, company_id: activeId } });
    },
    onSuccess: () => {
      toast.success("Bilancio eliminato");
      queryClient.invalidateQueries({ queryKey: ["balance-sheets", activeId] });
      setDeletingId(null);
    },
    onError: (e) => toast.error("Eliminazione fallita", { description: e instanceof Error ? e.message : "" }),
  });

  async function handleFile(file: File) {
    if (file.type !== "application/pdf") {
      toast.error("Seleziona un file PDF");
      return;
    }
    if (file.size > MAX_PDF_BYTES) {
      toast.error("File troppo grande (max 10 MB)");
      return;
    }
    setExtracting(true);
    try {
      const base64 = await fileToBase64(file);
      const res = await extractFn({ data: { pdf_base64: base64, filename: file.name } });
      if (res.status === "error") {
        toast.error("Estrazione fallita", { description: res.message });
        return;
      }
      setDraft(res.data);
      setDraftMapped(res.mapped);
      setPendingFile(file);
      toast.success("Bilancio estratto. Verifica e conferma.");
    } catch (e) {
      toast.error("Errore", { description: e instanceof Error ? e.message : "" });
    } finally {
      setExtracting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function updateDraft<K extends keyof Extracted>(key: K, value: Extracted[K]) {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
  }

  if (isLoading) {
    return <div className="flex items-center justify-center p-12 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /></div>;
  }
  if (!activeId || !active) {
    return (
      <div className="p-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Nessuna azienda selezionata</AlertTitle>
          <AlertDescription>Seleziona o crea un'azienda per gestire i bilanci.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <FileBarChart2 className="h-6 w-6" /> Bilanci
          </h1>
          <p className="text-sm text-muted-foreground">
            Carica un bilancio in PDF. L'AI legge Stato Patrimoniale e Conto Economico e popola i KPI.
          </p>
        </div>
        <div>
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
            }}
          />
          <Button onClick={() => fileRef.current?.click()} disabled={extracting}>
            {extracting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
            {extracting ? "Estrazione in corso…" : "Carica bilancio PDF"}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Bilanci caricati</CardTitle>
          <CardDescription>Storico bilanci confermati per {active.name}.</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingList ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : !sheets || sheets.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
              <FileText className="h-8 w-8" />
              <p className="text-sm">Nessun bilancio caricato. Carica il primo PDF per iniziare.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Anno</TableHead>
                  <TableHead className="text-right">Ricavi</TableHead>
                  <TableHead className="text-right">EBITDA</TableHead>
                  <TableHead className="text-right">Utile netto</TableHead>
                  <TableHead className="text-right">Patr. netto</TableHead>
                  <TableHead className="text-right">Debiti tot.</TableHead>
                  <TableHead className="text-right">Liquidità</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sheets.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.year}</TableCell>
                    <TableCell className="text-right">{formatEUR(Number(s.ricavi ?? 0))}</TableCell>
                    <TableCell className="text-right">{formatEUR(Number(s.ebitda ?? 0))}</TableCell>
                    <TableCell className="text-right">{formatEUR(Number(s.utile_netto ?? 0))}</TableCell>
                    <TableCell className="text-right">{formatEUR(Number(s.patrimonio_netto ?? 0))}</TableCell>
                    <TableCell className="text-right">{formatEUR(Number(s.debiti_totali ?? 0))}</TableCell>
                    <TableCell className="text-right">{formatEUR(Number(s.liquidita ?? 0))}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => setDeletingId(s.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog conferma con tab editabili */}
      <Dialog open={!!draft} onOpenChange={(o) => { if (!o) { setDraft(null); setDraftMapped(null); setPendingFile(null); } }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" /> Verifica dati estratti
            </DialogTitle>
            <DialogDescription>
              Controlla i valori estratti dall'AI. Puoi correggere ogni campo prima di salvare.
            </DialogDescription>
          </DialogHeader>

          {draft && (
            <Tabs defaultValue="riepilogo" className="w-full">
              <TabsList className="grid grid-cols-4 w-full">
                <TabsTrigger value="riepilogo">Riepilogo</TabsTrigger>
                <TabsTrigger value="anagrafica">Anagrafica</TabsTrigger>
                <TabsTrigger value="sp">Stato Patrimoniale</TabsTrigger>
                <TabsTrigger value="ce">Conto Economico</TabsTrigger>
              </TabsList>

              <TabsContent value="riepilogo" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <Kpi label="Ricavi" value={draft.ricavi} />
                  <Kpi label="EBITDA (calc.)" value={draftMapped?.ebitda ?? null} />
                  <Kpi label="Utile netto" value={draft.utile_netto} />
                  <Kpi label="Patrimonio netto" value={draft.patrimonio_netto} />
                  <Kpi label="Debiti totali (calc.)" value={draftMapped?.debiti_totali ?? null} />
                  <Kpi label="Liquidità" value={draft.liquidita} />
                </div>
                {(draft.mutui.length > 0 || draft.fornitori_top.length > 0) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {draft.mutui.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium mb-2">Mutui / finanziamenti rilevati</h4>
                        <div className="space-y-1">
                          {draft.mutui.map((m, i) => (
                            <div key={i} className="flex justify-between text-sm border rounded px-2 py-1">
                              <span className="truncate">{m.descrizione}</span>
                              <span className="font-medium">{m.residuo != null ? formatEUR(m.residuo) : "—"}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {draft.fornitori_top.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium mb-2">Fornitori principali</h4>
                        <div className="space-y-1">
                          {draft.fornitori_top.map((f, i) => (
                            <div key={i} className="flex justify-between text-sm border rounded px-2 py-1">
                              <span className="truncate">{f.nome}</span>
                              <span className="font-medium">{f.importo != null ? formatEUR(f.importo) : "—"}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="anagrafica" className="mt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Ragione sociale</Label>
                    <Input value={draft.legal_name ?? ""} onChange={(e) => updateDraft("legal_name", e.target.value || null)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Partita IVA</Label>
                    <Input value={draft.vat ?? ""} onChange={(e) => updateDraft("vat", e.target.value || null)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Anno</Label>
                    <Input
                      type="number"
                      value={draft.year ?? ""}
                      onChange={(e) => updateDraft("year", e.target.value === "" ? null : Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Inizio periodo</Label>
                    <Input type="date" value={draft.period_start ?? ""} onChange={(e) => updateDraft("period_start", e.target.value || null)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Fine periodo</Label>
                    <Input type="date" value={draft.period_end ?? ""} onChange={(e) => updateDraft("period_end", e.target.value || null)} />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="sp" className="mt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {numField("Attivo totale", draft.attivo_totale, (v) => updateDraft("attivo_totale", v))}
                  {numField("Immobilizzazioni", draft.immobilizzazioni, (v) => updateDraft("immobilizzazioni", v))}
                  {numField("Crediti clienti", draft.crediti_clienti, (v) => updateDraft("crediti_clienti", v))}
                  {numField("Liquidità (banche + cassa)", draft.liquidita, (v) => updateDraft("liquidita", v))}
                  {numField("Patrimonio netto", draft.patrimonio_netto, (v) => updateDraft("patrimonio_netto", v))}
                  {numField("Debiti banche < 12m", draft.debiti_banche_breve, (v) => updateDraft("debiti_banche_breve", v))}
                  {numField("Debiti banche > 12m", draft.debiti_banche_lungo, (v) => updateDraft("debiti_banche_lungo", v))}
                  {numField("Debiti fornitori", draft.debiti_fornitori, (v) => updateDraft("debiti_fornitori", v))}
                  {numField("Debiti tributari", draft.debiti_tributari, (v) => updateDraft("debiti_tributari", v))}
                  {numField("TFR", draft.tfr, (v) => updateDraft("tfr", v))}
                </div>
              </TabsContent>

              <TabsContent value="ce" className="mt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {numField("Ricavi", draft.ricavi, (v) => updateDraft("ricavi", v))}
                  {numField("Costi materie prime", draft.costi_materie, (v) => updateDraft("costi_materie", v))}
                  {numField("Costi servizi", draft.costi_servizi, (v) => updateDraft("costi_servizi", v))}
                  {numField("Costi del personale", draft.costi_personale, (v) => updateDraft("costi_personale", v))}
                  {numField("Ammortamenti", draft.ammortamenti, (v) => updateDraft("ammortamenti", v))}
                  {numField("Oneri finanziari", draft.oneri_finanziari, (v) => updateDraft("oneri_finanziari", v))}
                  {numField("Imposte", draft.imposte, (v) => updateDraft("imposte", v))}
                  {numField("Utile netto", draft.utile_netto, (v) => updateDraft("utile_netto", v))}
                </div>
              </TabsContent>
            </Tabs>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => { setDraft(null); setDraftMapped(null); setPendingFile(null); }}>
              Annulla
            </Button>
            <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
              {saveMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Conferma e salva
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingId} onOpenChange={(o) => !o && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare il bilancio?</AlertDialogTitle>
            <AlertDialogDescription>L'operazione non è reversibile.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={() => deletingId && deleteMut.mutate(deletingId)}>Elimina</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold mt-1">
        {value != null ? formatEUR(value) : <Badge variant="outline">n/d</Badge>}
      </div>
    </div>
  );
}
