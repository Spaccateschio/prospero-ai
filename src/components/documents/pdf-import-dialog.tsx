import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileText, Loader2, Upload, XCircle, CheckCircle2, ChevronDown, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";

import {
  startImportJob,
  processImportChunk,
  processInvoicesBatch,
  getImportJob,
  cancelImportJob,
} from "@/lib/documents.functions";
import { parseDaneaInvoices, parseDaneaRegistrazioni, type ParsedInvoice } from "@/lib/danea-parser";
import { formatEUR, formatDate } from "@/lib/format";

type Mode = "sales" | "purchases" | "other";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  companyId: string;
  mode: Mode;
};

const CHUNK_LINES = 60;       // righe per chunk (fallback AI)
const CONCURRENCY = 2;         // chunk paralleli max (fallback AI)
const BATCH_SIZE = 100;        // fatture per batch (parser deterministico)
const POLL_MS = 1500;

/** Estrae il testo da tutte le pagine usando pdfjs-dist nel browser. */
async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  const workerMod = (await import("pdfjs-dist/build/pdf.worker.mjs?url")) as { default: string };
  pdfjs.GlobalWorkerOptions.workerSrc = workerMod.default;

  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    // Ricostruisco linee usando le coordinate Y (ogni transform[5] cambia → nuova riga)
    let lastY: number | null = null;
    let line = "";
    const lines: string[] = [];
    for (const item of tc.items as Array<{ str: string; transform: number[] }>) {
      const y = item.transform[5];
      if (lastY !== null && Math.abs(y - lastY) > 2) {
        if (line.trim()) lines.push(line.trim());
        line = "";
      }
      line += (line ? " " : "") + item.str;
      lastY = y;
    }
    if (line.trim()) lines.push(line.trim());
    pages.push(lines.join("\n"));
  }
  return pages.join("\n");
}

function chunkText(text: string, linesPerChunk: number): string[] {
  const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];
  const out: string[] = [];
  for (let i = 0; i < lines.length; i += linesPerChunk) {
    out.push(lines.slice(i, i + linesPerChunk).join("\n"));
  }
  return out;
}

export function PdfImportDialog({ open, onOpenChange, companyId, mode }: Props) {
  const queryClient = useQueryClient();
  const startJob = useServerFn(startImportJob);
  const processChunk = useServerFn(processImportChunk);
  const processBatch = useServerFn(processInvoicesBatch);
  const fetchJob = useServerFn(getImportJob);
  const cancelJob = useServerFn(cancelImportJob);

  const [file, setFile] = useState<File | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [showSkipped, setShowSkipped] = useState(false);
  const [pending, setPending] = useState<ParsedInvoice[] | null>(null);
  const cancelledRef = useRef(false);

  const hintDirection: "attiva" | "passiva" | undefined =
    mode === "sales" ? "attiva" : mode === "purchases" ? "passiva" : undefined;

  const jobQuery = useQuery({
    queryKey: ["import_job", jobId],
    queryFn: () => fetchJob({ data: { job_id: jobId! } }),
    enabled: !!jobId,
    refetchInterval: (q) => {
      const s = q.state.data?.status;
      return s === "processing" || s === "pending" ? POLL_MS : false;
    },
  });

  // Quando il job termina, invalida le query elencate
  useEffect(() => {
    const s = jobQuery.data?.status;
    if (s === "completed" || s === "cancelled" || s === "failed") {
      queryClient.invalidateQueries({ queryKey: ["invoices", companyId] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    }
  }, [jobQuery.data?.status, companyId, queryClient]);

  const startMut = useMutation({
    mutationFn: async (f: File) => {
      cancelledRef.current = false;
      setPreparing(true);
      const text = await extractPdfText(f);
      const fallbackDir: "attiva" | "passiva" = hintDirection ?? "attiva";

      // 1) Tentativo parser deterministici (Elenco registrazioni, poi elenchi fatture Danea)
      const registrazioni = parseDaneaRegistrazioni(text);
      const deterministic: ParsedInvoice[] | null =
        registrazioni && registrazioni.length > 0
          ? registrazioni
          : parseDaneaInvoices(text, fallbackDir);

      if (deterministic && deterministic.length > 0) {
        // Non salviamo subito: mostriamo l'anteprima e aspettiamo la conferma.
        setPending(deterministic);
        setPreparing(false);
        toast.success(`Riconosciute ${deterministic.length} fatture dal PDF — controlla e conferma`);
        return { total: 0 };
      }

      // 2) Fallback: testo non riconosciuto → estrazione AI a chunk
      const chunks = chunkText(text, CHUNK_LINES);
      if (chunks.length === 0) throw new Error("Nessun testo estraibile dal PDF.");
      const { job_id } = await startJob({
        data: {
          company_id: companyId,
          filename: f.name,
          hint_direction: hintDirection ?? null,
          total_chunks: chunks.length,
        },
      });
      setJobId(job_id);
      setPreparing(false);

      let abortSent = false;
      const abortImport = async (err: unknown) => {
        if (abortSent) return;
        abortSent = true;
        cancelledRef.current = true;
        console.error("[chunk] import interrotto", err);
        try {
          await cancelJob({ data: { job_id } });
        } catch (cancelErr) {
          console.error("[chunk] annullamento fallito", cancelErr);
        }
      };

      let next = 0;
      const runWorker = async () => {
        while (true) {
          if (cancelledRef.current) return;
          const idx = next++;
          if (idx >= chunks.length) return;
          try {
            await processChunk({ data: { job_id, chunk_index: idx, text: chunks[idx] } });
          } catch (err) {
            await abortImport(err);
          }
        }
      };
      await Promise.all(Array.from({ length: CONCURRENCY }, () => runWorker()));
      return { total: chunks.length };
    },
    onError: (e) => {
      setPreparing(false);
      toast.error("Avvio import fallito", { description: e instanceof Error ? e.message : "" });
    },
  });

  const confirmMut = useMutation({
    mutationFn: async () => {
      if (!pending || pending.length === 0) return { total: 0 };
      cancelledRef.current = false;
      const rows = pending;
      const batches: ParsedInvoice[][] = [];
      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        batches.push(rows.slice(i, i + BATCH_SIZE));
      }
      const { job_id } = await startJob({
        data: {
          company_id: companyId,
          filename: file?.name ?? "import.pdf",
          hint_direction: hintDirection ?? null,
          total_chunks: batches.length,
        },
      });
      setJobId(job_id);
      setPending(null);

      let abortSent = false;
      const abortImport = async (err: unknown) => {
        if (abortSent) return;
        abortSent = true;
        cancelledRef.current = true;
        console.error("[batch] import interrotto", err);
        try {
          await cancelJob({ data: { job_id } });
        } catch (cancelErr) {
          console.error("[batch] annullamento fallito", cancelErr);
        }
      };

      for (let i = 0; i < batches.length; i++) {
        if (cancelledRef.current) break;
        try {
          await processBatch({
            data: { job_id, chunks_processed: 1, invoices: batches[i] },
          });
        } catch (err) {
          await abortImport(err);
        }
      }
      return { total: batches.length };
    },
    onError: (e) =>
      toast.error("Import fallito", { description: e instanceof Error ? e.message : "" }),
  });

  function reset() {
    setFile(null);
    setJobId(null);
    setPreparing(false);
    setPending(null);
    cancelledRef.current = false;
  }

  async function handleCancel() {
    if (!jobId) return;
    cancelledRef.current = true;
    try {
      await cancelJob({ data: { job_id: jobId } });
      await jobQuery.refetch();
      toast.info("Import annullato");
    } catch (e) {
      toast.error("Errore annullamento", { description: e instanceof Error ? e.message : "" });
    }
  }

  const job = jobQuery.data;
  const progress = job && job.total_chunks > 0
    ? Math.round((job.processed_chunks / job.total_chunks) * 100)
    : 0;
  const isRunning = preparing || job?.status === "processing" || job?.status === "pending";
  const isDone = job?.status === "completed" || job?.status === "cancelled" || job?.status === "failed";

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v && isRunning) return; // non chiudere durante l'esecuzione
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>
            Importa {mode === "sales" ? "fatture emesse" : mode === "purchases" ? "fatture ricevute" : "documenti"} da PDF
          </DialogTitle>
          <DialogDescription>
            Carica un PDF (fattura singola o elenco anche da centinaia di righe). Gli elenchi tabellari (Danea) vengono riconosciuti automaticamente con un parser veloce; altrimenti viene usata l'AI a blocchi.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!jobId && !preparing && pending && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded bg-muted/40 p-2">
                  <div className="text-lg font-semibold tabular-nums">{pending.length}</div>
                  <div className="text-muted-foreground">Fatture riconosciute</div>
                </div>
                <div className="rounded bg-muted/40 p-2">
                  <div className="text-lg font-semibold tabular-nums">
                    {new Set(pending.map((r) => r.counterpart_name.toLowerCase())).size}
                  </div>
                  <div className="text-muted-foreground">Soggetti</div>
                </div>
                <div className="rounded bg-muted/40 p-2">
                  <div className="text-lg font-semibold tabular-nums">
                    {formatEUR(pending.reduce((s, r) => s + r.total_amount, 0))}
                  </div>
                  <div className="text-muted-foreground">Totale</div>
                </div>
              </div>

              <div className="max-h-72 overflow-y-auto rounded border">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-background">
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="px-2 py-1.5 font-medium">Num</th>
                      <th className="px-2 py-1.5 font-medium">Data</th>
                      <th className="px-2 py-1.5 font-medium">Tipo</th>
                      <th className="px-2 py-1.5 font-medium">Soggetto</th>
                      <th className="px-2 py-1.5 text-right font-medium">Totale</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pending.map((r, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="px-2 py-1 font-mono">{r.number ?? "—"}</td>
                        <td className="px-2 py-1 whitespace-nowrap">{formatDate(r.issue_date)}</td>
                        <td className="px-2 py-1 capitalize">{r.document_type}</td>
                        <td className="max-w-[180px] truncate px-2 py-1">{r.counterpart_name}</td>
                        <td className="px-2 py-1 text-right tabular-nums">{formatEUR(r.total_amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="text-xs text-muted-foreground">
                Nessuna riga è stata ancora salvata. Controlla numeri (incluso il sezionale, es. 727/A), date e importi: con "Conferma e importa" le fatture vengono salvate, saltando quelle già presenti (stesso numero + data).
              </p>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={reset}>
                  Annulla
                </Button>
                <Button onClick={() => confirmMut.mutate()} disabled={confirmMut.isPending}>
                  {confirmMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <CheckCircle2 className="mr-2 h-4 w-4" /> Conferma e importa {pending.length} fatture
                </Button>
              </div>
            </div>
          )}

          {!jobId && !preparing && !pending && (
            <div className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8">
              <FileText className="h-10 w-10 text-muted-foreground" />
              <div className="text-center text-sm text-muted-foreground">
                Seleziona un PDF (max ~50 MB)
              </div>
              <Input
                type="file"
                accept="application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="max-w-sm"
              />
              {file && (
                <Button onClick={() => startMut.mutate(file)}>
                  <Upload className="mr-2 h-4 w-4" /> Importa {file.name}
                </Button>
              )}
            </div>
          )}

          {preparing && (
            <div className="flex items-center gap-3 rounded-md bg-muted/40 p-4 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Estrazione testo dal PDF in corso…
            </div>
          )}

          {job && (
            <div className="space-y-3 rounded-md border p-4">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 font-medium">
                  {job.status === "completed" && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                  {job.status === "cancelled" && <XCircle className="h-4 w-4 text-muted-foreground" />}
                  {job.status === "failed" && <XCircle className="h-4 w-4 text-destructive" />}
                  {(job.status === "processing" || job.status === "pending") && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                  {job.status === "processing" || job.status === "pending"
                    ? "Importazione in corso"
                    : job.status === "completed"
                    ? "Importazione completata"
                    : job.status === "cancelled"
                    ? "Importazione annullata"
                    : "Importazione fallita"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {job.processed_chunks}/{job.total_chunks} blocchi
                </div>
              </div>

              <Progress value={progress} />

              <div className="grid grid-cols-4 gap-2 text-center text-xs">
                <div className="rounded bg-muted/40 p-2">
                  <div className="text-lg font-semibold tabular-nums">{job.inserted_count}</div>
                  <div className="text-muted-foreground">Salvate</div>
                </div>
                <div className="rounded bg-muted/40 p-2">
                  <div className="text-lg font-semibold tabular-nums">{job.processed_chunks}</div>
                  <div className="text-muted-foreground">Blocchi processati</div>
                </div>
                <div className="rounded bg-muted/40 p-2">
                  <div className="text-lg font-semibold tabular-nums text-amber-600">
                    {job.skipped_count ?? 0}
                  </div>
                  <div className="text-muted-foreground">Duplicati</div>
                </div>
                <div className="rounded bg-muted/40 p-2">
                  <div className="text-lg font-semibold tabular-nums text-destructive">
                    {job.failed_chunks}
                  </div>
                  <div className="text-muted-foreground">Falliti</div>
                </div>
              </div>

              {job.error_message && (
                <div className="rounded bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {job.error_message}
                </div>
              )}

              {(job.skipped_count ?? 0) > 0 && (
                <div className="rounded border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs font-medium text-amber-800 dark:text-amber-300"
                    onClick={() => setShowSkipped((v) => !v)}
                  >
                    <span className="flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      {job.skipped_count} document{job.skipped_count === 1 ? "o" : "i"} non {job.skipped_count === 1 ? "importato" : "importati"} (numero + data già presenti)
                    </span>
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showSkipped ? "rotate-180" : ""}`} />
                  </button>
                  {showSkipped && (
                    <div className="max-h-48 overflow-y-auto border-t border-amber-200 px-3 py-2 dark:border-amber-900">
                      {((job.skipped_details as Array<{ number: string | null; counterpart_name: string; issue_date: string | null; total_amount: number }>) ?? []).map((d, i) => (
                        <div key={i} className="flex items-center justify-between gap-2 py-1 text-xs text-amber-900 dark:text-amber-200">
                          <span className="font-mono">{d.number ?? "—"}</span>
                          <span className="flex-1 truncate px-2">{d.counterpart_name}</span>
                          <span>{formatDate(d.issue_date)}</span>
                          <span className="tabular-nums">{formatEUR(d.total_amount)}</span>
                        </div>
                      ))}
                      {job.skipped_count > (job.skipped_details as unknown[])?.length && (
                        <p className="pt-1 text-[10px] text-amber-700 dark:text-amber-400">
                          Elenco troncato a 300 voci; il totale scartati è comunque {job.skipped_count}.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                I duplicati (stesso numero + data) vengono saltati automaticamente.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          {isRunning ? (
            <Button variant="outline" onClick={handleCancel}>
              Annulla
            </Button>
          ) : isDone ? (
            <>
              <Button variant="outline" onClick={reset}>
                Importa un altro PDF
              </Button>
              <Button onClick={() => onOpenChange(false)}>Chiudi</Button>
            </>
          ) : (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Chiudi
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
