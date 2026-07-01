import { useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import * as XLSX from "xlsx";
import { Download, Upload, FileSpreadsheet, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

import { importInvoicesBatch } from "@/lib/documents.functions";
import { mapDocType, normalizeDate, parseNumber } from "@/lib/danea-parser";
import { formatEUR } from "@/lib/format";

type Mode = "export" | "import";

type Row = {
  id: string;
  number: string | null;
  document_type: string;
  counterpart_name: string;
  counterpart_vat: string | null;
  issue_date: string | null;
  due_date: string | null;
  total_amount: number;
  paid_amount: number;
  payment_method: string | null;
  notes: string | null;
  effective_status: string;
};

type ImportedRow = {
  document_type: "fattura" | "parcella" | "nota_credito" | "ricevuta" | "ddt";
  number: string | null;
  counterpart_name: string;
  counterpart_vat: string | null;
  issue_date: string | null;
  due_date: string | null;
  total_amount: number;
  payment_method: string | null;
  notes: string | null;
};

function cell(v: unknown): string | null {
  const s = v === undefined || v === null ? "" : String(v).trim();
  return s.length > 0 ? s : null;
}

/** Accetta date come stringa gg/mm/aaaa, stringa ISO, oppure oggetto Date (Excel con cellDates). */
function normalizeAnyDate(v: unknown): string | null {
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return v.toISOString().slice(0, 10);
  }
  const s = cell(v);
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return normalizeDate(s);
}

/** Accetta importi come numero già pulito o stringa tipo "1.234,56" / "€ 1.234,56". */
function normalizeAmount(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const s = cell(v);
  if (!s) return null;
  return parseNumber(s);
}

export function DocsImportExportDialog({
  open,
  onOpenChange,
  companyId,
  direction,
  mode,
  rows,
  selectedIds,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  companyId: string;
  direction: "attiva" | "passiva";
  mode: "sales" | "purchases" | "other";
  rows: Row[];
  selectedIds: Set<string>;
}) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Mode>("export");
  const [scope, setScope] = useState<"selected" | "all">("all");
  const [parsedRows, setParsedRows] = useState<ImportedRow[] | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [skippedInfo, setSkippedInfo] = useState<{ count: number; details: Array<{ number: string | null; counterpart_name: string; issue_date: string | null; total_amount: number }> } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const importFn = useServerFn(importInvoicesBatch);
  const selectedCount = rows.filter((r) => selectedIds.has(r.id)).length;

  function handleExport() {
    const target = scope === "selected" ? rows.filter((r) => selectedIds.has(r.id)) : rows;
    if (target.length === 0) {
      toast.error("Nessun documento da esportare");
      return;
    }
    const data = target.map((r) => ({
      Numero: r.number ?? "",
      Data: r.issue_date ?? "",
      "Tipo documento": r.document_type,
      [direction === "attiva" ? "Cliente" : "Fornitore"]: r.counterpart_name,
      "P.IVA": r.counterpart_vat ?? "",
      "Totale documento": r.total_amount,
      Pagato: r.paid_amount,
      "Saldo aperto": Math.max(0, r.total_amount - (r.paid_amount ?? 0)),
      Scadenza: r.due_date ?? "",
      Stato: r.effective_status,
      "Metodo pagamento": r.payment_method ?? "",
      Note: r.notes ?? "",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    ws["!cols"] = Object.keys(data[0]).map((h) => ({ wch: Math.max(12, h.length + 4) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Documenti");
    const label = mode === "sales" ? "fatture-emesse" : mode === "purchases" ? "fatture-ricevute" : "documenti";
    XLSX.writeFile(wb, `${label}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success(`Esportati ${target.length} documenti`);
  }

  function handleFileSelect(f: File | null) {
    setParsedRows(null);
    setParseError(null);
    setSkippedInfo(null);
    if (!f) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const buf = e.target?.result;
        const wb = XLSX.read(buf, { type: "array", cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });

        const out: ImportedRow[] = [];
        for (const r of json) {
          const number = cell(r["Numero"] ?? r["Num"] ?? r["N."]);
          const counterpart_name = cell(
            r["Cliente"] ?? r["Fornitore"] ?? r["Nominativo"] ?? r["Nome"] ?? r["Ragione Sociale"],
          );
          if (!counterpart_name) continue;
          const total_amount = normalizeAmount(r["Totale documento"] ?? r["Totale"] ?? r["Importo"]);
          if (total_amount === null || total_amount <= 0) continue;
          const issue_date = normalizeAnyDate(r["Data"] ?? r["Data documento"] ?? r["Data emissione"]);
          const due_date = normalizeAnyDate(r["Scadenza"] ?? r["Data scadenza"] ?? r["Due date"]);
          const typeRaw = cell(r["Tipo documento"] ?? r["Tipo"]) ?? "fattura";

          out.push({
            document_type: mapDocType(typeRaw),
            number,
            counterpart_name,
            counterpart_vat: cell(r["P.IVA"] ?? r["Partita IVA"]),
            issue_date,
            due_date,
            total_amount,
            payment_method: cell(r["Metodo pagamento"] ?? r["Pagamento"]),
            notes: cell(r["Note"]),
          });
        }

        if (out.length === 0) {
          setParseError("Nessuna riga valida trovata. Servono almeno le colonne 'Cliente/Fornitore' e 'Totale documento'.");
        } else {
          setParsedRows(out);
        }
      } catch (err) {
        setParseError(err instanceof Error ? err.message : "Errore durante la lettura del file");
      }
    };
    reader.readAsArrayBuffer(f);
  }

  const importMut = useMutation({
    mutationFn: () => importFn({ data: { company_id: companyId, direction, rows: parsedRows! } }),
    onSuccess: (res) => {
      toast.success(`Importati ${res.inserted} documenti su ${res.total}`);
      if (res.skipped_count > 0) {
        setSkippedInfo({ count: res.skipped_count, details: res.skipped });
      } else {
        reset();
        onOpenChange(false);
      }
      queryClient.invalidateQueries({ queryKey: ["invoices", companyId] });
    },
    onError: (e) => toast.error("Errore import", { description: e instanceof Error ? e.message : "" }),
  });

  function reset() {
    setParsedRows(null);
    setParseError(null);
    setSkippedInfo(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const preview = useMemo(() => parsedRows?.slice(0, 5) ?? [], [parsedRows]);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
            Import/Export Excel documenti
          </DialogTitle>
          <DialogDescription>
            Importa da file XLSX/XLS/ODS con colonne (Numero, Data, Tipo documento, {direction === "attiva" ? "Cliente" : "Fornitore"}, Totale); export sempre in XLSX.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as Mode)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="export"><Download className="mr-2 h-4 w-4" /> Esporta</TabsTrigger>
            <TabsTrigger value="import"><Upload className="mr-2 h-4 w-4" /> Importa</TabsTrigger>
          </TabsList>
        </Tabs>

        {tab === "export" ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm dark:border-emerald-900 dark:bg-emerald-950/30">
              <p className="mb-2 flex items-center gap-2 font-medium text-emerald-800 dark:text-emerald-300">
                <FileSpreadsheet className="h-4 w-4" /> Export Excel professionale
              </p>
              <ul className="space-y-1 text-emerald-700 dark:text-emerald-400">
                <li className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5" /> Tutti i campi documento</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5" /> Totale, pagato e saldo aperto inclusi</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5" /> Formato XLSX nativo</li>
              </ul>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">Documenti da esportare</p>
              <RadioGroup value={scope} onValueChange={(v) => setScope(v as typeof scope)} className="flex gap-6">
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="selected" id="doc-scope-selected" disabled={selectedCount === 0} />
                  <Label htmlFor="doc-scope-selected" className="font-normal">Selezionati ({selectedCount})</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="all" id="doc-scope-all" />
                  <Label htmlFor="doc-scope-all" className="font-normal">Tutti ({rows.length})</Label>
                </div>
              </RadioGroup>
            </div>
            <Button className="w-full bg-emerald-600 hover:bg-emerald-700" onClick={handleExport}>
              <Download className="mr-2 h-4 w-4" /> Esporta in Excel (XLSX)
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {!parsedRows && (
              <div className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8">
                <Upload className="h-10 w-10 text-muted-foreground" />
                <div className="text-center text-sm text-muted-foreground">Seleziona un file XLSX, XLS o ODS</div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.ods"
                  className="max-w-xs text-sm"
                  onChange={(e) => handleFileSelect(e.target.files?.[0] ?? null)}
                />
                <p className="text-center text-xs text-muted-foreground">
                  Colonne riconosciute: Numero, Data, Tipo documento, {direction === "attiva" ? "Cliente" : "Fornitore"}, P.IVA, Totale documento, Scadenza, Metodo pagamento, Note.
                  Vanno bene anche gli export "Elenco documenti" tipo Danea Easyfatt.
                </p>
              </div>
            )}

            {parseError && (
              <div className="rounded bg-destructive/10 px-3 py-2 text-xs text-destructive">{parseError}</div>
            )}

            {parsedRows && !skippedInfo && (
              <div className="space-y-3">
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm dark:border-emerald-900 dark:bg-emerald-950/30">
                  <p className="flex items-center gap-2 font-medium text-emerald-800 dark:text-emerald-300">
                    <CheckCircle2 className="h-4 w-4" /> {parsedRows.length} documenti pronti per l'import
                  </p>
                </div>
                <div className="max-h-40 overflow-y-auto rounded border text-xs">
                  {preview.map((r, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 border-b px-3 py-1.5 last:border-0">
                      <span className="font-mono text-muted-foreground">{r.number ?? "—"}</span>
                      <span className="flex-1 truncate px-2 font-medium">{r.counterpart_name}</span>
                      <span className="tabular-nums">{formatEUR(r.total_amount)}</span>
                    </div>
                  ))}
                  {parsedRows.length > 5 && (
                    <div className="px-3 py-1.5 text-muted-foreground">…e altri {parsedRows.length - 5} documenti</div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={reset}>Scegli un altro file</Button>
                  <Button className="flex-1" disabled={importMut.isPending} onClick={() => importMut.mutate()}>
                    {importMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                    Importa {parsedRows.length} documenti
                  </Button>
                </div>
              </div>
            )}

            {skippedInfo && (
              <div className="space-y-3">
                <div className="rounded border border-amber-200 bg-amber-50 p-3 text-xs dark:border-amber-900 dark:bg-amber-950/30">
                  <p className="mb-2 flex items-center gap-1.5 font-medium text-amber-800 dark:text-amber-300">
                    <AlertTriangle className="h-3.5 w-3.5" /> {skippedInfo.count} documenti non importati (numero+data già presenti)
                  </p>
                  <div className="max-h-40 space-y-1 overflow-y-auto">
                    {skippedInfo.details.map((d, i) => (
                      <div key={i} className="flex items-center justify-between gap-2 text-amber-900 dark:text-amber-200">
                        <span className="font-mono">{d.number ?? "—"}</span>
                        <span className="flex-1 truncate px-2">{d.counterpart_name}</span>
                        <span className="tabular-nums">{formatEUR(d.total_amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <Button className="w-full" onClick={() => { reset(); onOpenChange(false); }}>Chiudi</Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
