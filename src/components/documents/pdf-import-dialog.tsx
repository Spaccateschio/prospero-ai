import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileText, Loader2, Upload, XCircle, CheckCircle2 } from "lucide-react";
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
  getImportJob,
  cancelImportJob,
} from "@/lib/documents.functions";

type Mode = "sales" | "purchases" | "other";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  companyId: string;
  mode: Mode;
};

const CHUNK_LINES = 60;       // righe di testo per chunk
const CONCURRENCY = 2;         // chunk paralleli max
const POLL_MS = 1500;

/** Estrae il testo da tutte le pagine usando pdfjs-dist nel browser. */
async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  // @ts-expect-error worker entry esiste a runtime
  const workerSrc = (await import("pdfjs-dist/build/pdf.worker.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

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
  const fetchJob = useServerFn(getImportJob);
  const cancelJob = useServerFn(cancelImportJob);

  const [file, setFile] = useState<File | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
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

      // Worker pool con concorrenza limitata
      let next = 0;
      const runWorker = async () => {
        while (true) {
          if (cancelledRef.current) return;
          const idx = next++;
          if (idx >= chunks.length) return;
          try {
            await processChunk({ data: { job_id, chunk_index: idx, text: chunks[idx] } });
          } catch (err) {
            console.error("[chunk]", idx, err);
            // Il server marca già il fallimento; qui continuiamo con gli altri
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

  function reset() {
    setFile(null);
    setJobId(null);
    setPreparing(false);
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
            Carica un PDF (fattura singola o elenco anche da centinaia di righe). L'AI estrae i dati a blocchi e li salva man mano.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!jobId && !preparing && (
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

              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded bg-muted/40 p-2">
                  <div className="text-lg font-semibold tabular-nums">{job.inserted_count}</div>
                  <div className="text-muted-foreground">Salvate</div>
                </div>
                <div className="rounded bg-muted/40 p-2">
                  <div className="text-lg font-semibold tabular-nums">{job.processed_chunks}</div>
                  <div className="text-muted-foreground">Blocchi processati</div>
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
