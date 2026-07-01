import { useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileCode2, Upload, Loader2, CheckCircle2, AlertTriangle, HelpCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

import { importInvoicesBatch } from "@/lib/documents.functions";
import { parseFatturaPA, type ParsedXmlInvoice } from "@/lib/fatturapa-parser";
import { formatEUR } from "@/lib/format";

type ImportedRow = ParsedXmlInvoice & { direction: "attiva" | "passiva" };

export function XmlImportDialog({
  open,
  onOpenChange,
  companyId,
  companyVat,
  fallbackDirection,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  companyId: string;
  companyVat: string | null;
  fallbackDirection: "attiva" | "passiva";
}) {
  const queryClient = useQueryClient();
  const [parsedRows, setParsedRows] = useState<ImportedRow[] | null>(null);
  const [unknownDirCount, setUnknownDirCount] = useState(0);
  const [manualDirection, setManualDirection] = useState<"attiva" | "passiva">(fallbackDirection);
  const [errors, setErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importFn = useServerFn(importInvoicesBatch);

  function handleFilesSelect(files: FileList | null) {
    setParsedRows(null);
    setErrors([]);
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    let pending = fileArray.length;
    const allRows: ParsedXmlInvoice[] = [];
    const fileErrors: string[] = [];

    fileArray.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target?.result as string;
          const rows = parseFatturaPA(text, companyVat);
          if (rows.length === 0) fileErrors.push(`${file.name}: nessuna fattura valida trovata`);
          allRows.push(...rows);
        } catch (err) {
          fileErrors.push(`${file.name}: ${err instanceof Error ? err.message : "errore di lettura"}`);
        } finally {
          pending -= 1;
          if (pending === 0) finalize(allRows, fileErrors);
        }
      };
      reader.onerror = () => {
        fileErrors.push(`${file.name}: impossibile leggere il file`);
        pending -= 1;
        if (pending === 0) finalize(allRows, fileErrors);
      };
      reader.readAsText(file);
    });
  }

  function finalize(rows: ParsedXmlInvoice[], fileErrors: string[]) {
    setErrors(fileErrors);
    const unknown = rows.filter((r) => r.direction === null).length;
    setUnknownDirCount(unknown);
    const resolved: ImportedRow[] = rows.map((r) => ({
      ...r,
      direction: r.direction ?? fallbackDirection,
    }));
    if (resolved.length > 0) setParsedRows(resolved);
  }

  function applyManualDirection(dir: "attiva" | "passiva") {
    setManualDirection(dir);
    if (!parsedRows) return;
    setParsedRows(parsedRows.map((r) => ({ ...r, direction: dir })));
  }

  const importMut = useMutation({
    mutationFn: () =>
      importFn({
        data: {
          company_id: companyId,
          direction: parsedRows![0].direction,
          rows: parsedRows!.map((r) => ({
            document_type: r.document_type,
            number: r.number,
            counterpart_name: r.counterpart_name,
            counterpart_vat: r.counterpart_vat,
            issue_date: r.issue_date,
            due_date: r.due_date,
            total_amount: r.total_amount,
            payment_method: r.payment_method,
            notes: r.notes,
          })),
        },
      }),
    onSuccess: (res) => {
      toast.success(`Importate ${res.inserted} fatture su ${res.total}`);
      queryClient.invalidateQueries({ queryKey: ["invoices", companyId] });
      reset();
      onOpenChange(false);
    },
    onError: (e) => toast.error("Errore import", { description: e instanceof Error ? e.message : "" }),
  });

  function reset() {
    setParsedRows(null);
    setErrors([]);
    setUnknownDirCount(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const preview = useMemo(() => parsedRows?.slice(0, 5) ?? [], [parsedRows]);
  const total = useMemo(() => (parsedRows ?? []).reduce((s, r) => s + r.total_amount, 0), [parsedRows]);

  const mixedDirections = parsedRows
    ? new Set(parsedRows.map((r) => r.direction)).size > 1
    : false;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileCode2 className="h-5 w-5 text-emerald-600" />
            Importa fatture elettroniche XML
          </DialogTitle>
          <DialogDescription>
            Carica uno o più file .xml FatturaPA (dallo SDI, PEC o gestionale). Puoi selezionarne molti insieme.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!parsedRows && (
            <div className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8">
              <Upload className="h-10 w-10 text-muted-foreground" />
              <div className="text-center text-sm text-muted-foreground">Seleziona uno o più file .xml</div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xml"
                multiple
                className="max-w-xs text-sm"
                onChange={(e) => handleFilesSelect(e.target.files)}
              />
              <p className="flex items-center gap-1.5 text-center text-xs text-muted-foreground">
                <HelpCircle className="h-3.5 w-3.5 shrink-0" />
                I file .xml.p7m firmati digitalmente non sono ancora supportati: estrai prima l'XML dalla firma.
              </p>
            </div>
          )}

          {errors.length > 0 && (
            <div className="space-y-1 rounded bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {errors.map((e, i) => <div key={i}>{e}</div>)}
            </div>
          )}

          {parsedRows && (
            <div className="space-y-3">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm dark:border-emerald-900 dark:bg-emerald-950/30">
                <p className="flex items-center gap-2 font-medium text-emerald-800 dark:text-emerald-300">
                  <CheckCircle2 className="h-4 w-4" /> {parsedRows.length} fatture lette · {formatEUR(total)}
                </p>
              </div>

              {unknownDirCount > 0 && (
                <div className="space-y-2 rounded border border-amber-200 bg-amber-50 p-3 text-xs dark:border-amber-900 dark:bg-amber-950/30">
                  <p className="flex items-center gap-1.5 font-medium text-amber-800 dark:text-amber-300">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Non conosco la P.IVA della tua azienda: non riesco a capire da solo se {unknownDirCount === parsedRows.length ? "queste sono" : `${unknownDirCount} di queste sono`} fatture emesse o ricevute.
                  </p>
                  <RadioGroup value={manualDirection} onValueChange={(v) => applyManualDirection(v as "attiva" | "passiva")} className="flex gap-4">
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="attiva" id="xml-dir-attiva" />
                      <Label htmlFor="xml-dir-attiva" className="text-xs font-normal">Sono fatture emesse (clienti)</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="passiva" id="xml-dir-passiva" />
                      <Label htmlFor="xml-dir-passiva" className="text-xs font-normal">Sono fatture ricevute (fornitori)</Label>
                    </div>
                  </RadioGroup>
                </div>
              )}

              {mixedDirections && unknownDirCount === 0 && (
                <div className="rounded bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                  Attenzione: questo lotto contiene sia fatture emesse che ricevute — verranno importate insieme nella direzione rilevata automaticamente per ciascuna.
                </div>
              )}

              <div className="max-h-40 overflow-y-auto rounded border text-xs">
                {preview.map((r, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 border-b px-3 py-1.5 last:border-0">
                    <span className="font-mono text-muted-foreground">{r.number ?? "—"}</span>
                    <span className="flex-1 truncate px-2 font-medium">{r.counterpart_name}</span>
                    <span className="text-[10px] uppercase text-muted-foreground">{r.direction === "attiva" ? "emessa" : "ricevuta"}</span>
                    <span className="tabular-nums">{formatEUR(r.total_amount)}</span>
                  </div>
                ))}
                {parsedRows.length > 5 && (
                  <div className="px-3 py-1.5 text-muted-foreground">…e altre {parsedRows.length - 5} fatture</div>
                )}
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={reset}>Scegli altri file</Button>
                <Button className="flex-1" disabled={importMut.isPending} onClick={() => importMut.mutate()}>
                  {importMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                  Importa {parsedRows.length} fatture
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
