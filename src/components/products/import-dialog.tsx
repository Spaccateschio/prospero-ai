import { useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import * as XLSX from "xlsx";
import { Upload, FileSpreadsheet, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

import { importProductSales } from "@/lib/products.functions";
import { formatEUR } from "@/lib/format";

type ParsedRow = {
  sale_date: string;
  counterpart_name: string;
  product_name: string;
  product_code: string | null;
  category: string | null;
  unit: string | null;
  quantity: number;
  unit_price: number;
  total_amount: number;
  reference_doc: string | null;
};

const HEADER_ALIASES: Record<string, string[]> = {
  date: ["data"],
  counterpart: ["cliente / fornitore", "cliente/fornitore", "soggetto", "cliente", "fornitore", "nominativo"],
  product: ["prodotto", "articolo"],
  price: ["prezzo"],
  quantity: ["scaricato", "q.ta", "qta", "quantità", "quantita"],
  code: ["cod.", "codice", "cod"],
  category: ["categoria"],
  unit: ["u.m.", "um", "udm"],
  causale: ["causale"],
  amount: ["importo riga", "importo", "totale riga", "totale"],
};

function findHeaderRow(raw: unknown[][]): { rowIndex: number; colMap: Record<string, number> } | null {
  for (let i = 0; i < Math.min(raw.length, 10); i++) {
    const row = raw[i];
    if (!Array.isArray(row)) continue;
    const colMap: Record<string, number> = {};
    row.forEach((cell, idx) => {
      const norm = String(cell ?? "").trim().toLowerCase();
      if (!norm) return;
      for (const [key, aliases] of Object.entries(HEADER_ALIASES)) {
        if (colMap[key] !== undefined) continue;
        if (aliases.includes(norm)) colMap[key] = idx;
      }
    });
    if (colMap.date !== undefined && colMap.product !== undefined) {
      return { rowIndex: i, colMap };
    }
  }
  return null;
}

/**
 * L'intestazione a volte è disallineata rispetto ai dati reali (celle unite
 * nel file sorgente, tipico di export gestionali). Verifichiamo quale colonna
 * contiene davvero oggetti Date nelle righe successive e correggiamo se serve.
 */
function findRealDateColumn(raw: unknown[][], startRow: number, hint: number): number {
  const counts = new Map<number, number>();
  const sampleEnd = Math.min(raw.length, startRow + 40);
  for (let i = startRow; i < sampleEnd; i++) {
    const row = raw[i];
    if (!Array.isArray(row)) continue;
    row.forEach((cell, idx) => {
      if (cell instanceof Date && !Number.isNaN(cell.getTime())) {
        counts.set(idx, (counts.get(idx) ?? 0) + 1);
      }
    });
  }
  if (counts.size === 0) return hint;
  let best = hint;
  let bestCount = -1;
  for (const [idx, c] of counts) {
    if (c > bestCount) {
      bestCount = c;
      best = idx;
    }
  }
  return best;
}

function toDateStr(v: unknown): string | null {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  const s = v === undefined || v === null ? "" : String(v).trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    const year = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${year}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  return null;
}

function toNum(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const s = v === undefined || v === null ? "" : String(v).trim();
  if (!s) return null;
  const cleaned = s.replace(/[€$]/g, "").replace(/\s/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function ProductSalesImportDialog({
  open,
  onOpenChange,
  companyId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  companyId: string;
}) {
  const queryClient = useQueryClient();
  const [parsedRows, setParsedRows] = useState<ParsedRow[] | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importFn = useServerFn(importProductSales);

  function handleFileSelect(f: File | null) {
    setParsedRows(null);
    setParseError(null);
    if (!f) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const buf = e.target?.result;
        const wb = XLSX.read(buf, { type: "array", cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" });

        const header = findHeaderRow(raw);
        if (!header) {
          setParseError("Non trovo colonne 'Data' e 'Prodotto/Articolo'. Controlla l'intestazione del file.");
          return;
        }
        const { rowIndex, colMap } = header;
        if (colMap.date !== undefined) {
          colMap.date = findRealDateColumn(raw, rowIndex + 1, colMap.date);
        }
        const out: ParsedRow[] = [];

        for (let i = rowIndex + 1; i < raw.length; i++) {
          const row = raw[i];
          if (!Array.isArray(row)) continue;
          const productName = String(row[colMap.product] ?? "").trim();
          if (!productName) continue; // riga di raggruppamento o vuota

          const dateStr = toDateStr(row[colMap.date]);
          const counterpart = colMap.counterpart !== undefined ? String(row[colMap.counterpart] ?? "").trim() : "";
          if (!dateStr || !counterpart) continue;

          const price = colMap.price !== undefined ? toNum(row[colMap.price]) : null;
          const quantity = colMap.quantity !== undefined ? toNum(row[colMap.quantity]) : null;
          if (price === null || quantity === null || quantity <= 0) continue;

          const amountFromFile = colMap.amount !== undefined ? toNum(row[colMap.amount]) : null;
          const total_amount = amountFromFile ?? price * quantity;

          out.push({
            sale_date: dateStr,
            counterpart_name: counterpart,
            product_name: productName,
            product_code: colMap.code !== undefined ? (String(row[colMap.code] ?? "").trim() || null) : null,
            category: colMap.category !== undefined ? (String(row[colMap.category] ?? "").trim() || null) : null,
            unit: colMap.unit !== undefined ? (String(row[colMap.unit] ?? "").trim() || null) : null,
            quantity,
            unit_price: price,
            total_amount,
            reference_doc: colMap.causale !== undefined ? (String(row[colMap.causale] ?? "").trim() || null) : null,
          });
        }

        if (out.length === 0) {
          setParseError("Nessuna riga valida trovata nel file.");
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
    mutationFn: () => importFn({ data: { company_id: companyId, rows: parsedRows! } }),
    onSuccess: (res) => {
      toast.success(`Importate ${res.inserted} righe su ${res.total}`);
      queryClient.invalidateQueries({ queryKey: ["product_analytics", companyId] });
      reset();
      onOpenChange(false);
    },
    onError: (e) => toast.error("Errore import", { description: e instanceof Error ? e.message : "" }),
  });

  function reset() {
    setParsedRows(null);
    setParseError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const preview = useMemo(() => parsedRows?.slice(0, 5) ?? [], [parsedRows]);
  const totals = useMemo(() => {
    if (!parsedRows) return null;
    const distinctProducts = new Set(parsedRows.map((r) => r.product_name.toLowerCase())).size;
    const total = parsedRows.reduce((s, r) => s + r.total_amount, 0);
    return { distinctProducts, total };
  }, [parsedRows]);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
            Importa movimenti prodotto
          </DialogTitle>
          <DialogDescription>
            Carica l'export "Movimenti magazzino" / "Scarichi magazzino" (XLSX, XLS, ODS) — riconosce sia il formato ricco (con codice, categoria, causale) sia quello semplice (Data, Articolo, Q.ta, Prezzo, Soggetto).
          </DialogDescription>
        </DialogHeader>

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
            </div>
          )}

          {parseError && (
            <div className="rounded bg-destructive/10 px-3 py-2 text-xs text-destructive">{parseError}</div>
          )}

          {parsedRows && totals && (
            <div className="space-y-3">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm dark:border-emerald-900 dark:bg-emerald-950/30">
                <p className="flex items-center gap-2 font-medium text-emerald-800 dark:text-emerald-300">
                  <CheckCircle2 className="h-4 w-4" /> {parsedRows.length} righe · {totals.distinctProducts} prodotti diversi · {formatEUR(totals.total)}
                </p>
              </div>
              <div className="max-h-40 overflow-y-auto rounded border text-xs">
                {preview.map((r, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 border-b px-3 py-1.5 last:border-0">
                    <span className="flex-1 truncate font-medium">{r.product_name}</span>
                    <span className="truncate text-muted-foreground">{r.counterpart_name}</span>
                    <span className="tabular-nums">{r.quantity} {r.unit ?? ""}</span>
                    <span className="tabular-nums">{formatEUR(r.total_amount)}</span>
                  </div>
                ))}
                {parsedRows.length > 5 && (
                  <div className="px-3 py-1.5 text-muted-foreground">…e altre {parsedRows.length - 5} righe</div>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={reset}>Scegli un altro file</Button>
                <Button className="flex-1" disabled={importMut.isPending} onClick={() => importMut.mutate()}>
                  {importMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                  Importa {parsedRows.length} righe
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
