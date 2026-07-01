import { useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import * as XLSX from "xlsx";
import { Download, Upload, FileSpreadsheet, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

import { importCounterparts, type CounterpartRow } from "@/lib/counterparts.functions";

type Mode = "export" | "import";

const EXPORT_HEADERS = [
  "Nome", "Tipo", "P.IVA", "Codice Fiscale", "Email", "Telefono", "Zona", "Categoria", "Note",
] as const;

type ImportedRow = {
  name: string;
  type: "cliente" | "fornitore" | "entrambi";
  vat: string | null;
  fiscal_code: string | null;
  email: string | null;
  phone: string | null;
  zone: string | null;
  category: string | null;
  notes: string | null;
};

function normalizeType(v: unknown): "cliente" | "fornitore" | "entrambi" {
  const s = String(v ?? "").trim().toLowerCase();
  if (s.startsWith("forn")) return "fornitore";
  if (s.startsWith("entr") || s === "both") return "entrambi";
  return "cliente";
}
function cell(v: unknown): string | null {
  const s = v === undefined || v === null ? "" : String(v).trim();
  return s.length > 0 ? s : null;
}

export function CounterpartsImportExportDialog({
  open,
  onOpenChange,
  companyId,
  rows,
  selectedIds,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  companyId: string;
  rows: CounterpartRow[];
  selectedIds: Set<string>;
}) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<Mode>("export");
  const [scope, setScope] = useState<"selected" | "all">("all");
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ImportedRow[] | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const importFn = useServerFn(importCounterparts);

  const selectedCount = rows.filter((r) => selectedIds.has(r.key)).length;

  function handleExport() {
    const target = scope === "selected" ? rows.filter((r) => selectedIds.has(r.key)) : rows;
    if (target.length === 0) {
      toast.error("Nessun elemento da esportare");
      return;
    }
    const data = target.map((r) => ({
      Nome: r.name,
      Tipo: r.type === "cliente" ? "Cliente" : "Fornitore",
      "P.IVA": r.vat ?? "",
      "Codice Fiscale": r.fiscal_code ?? "",
      Email: r.email ?? "",
      Telefono: r.phone ?? "",
      Zona: r.zone ?? "",
      Categoria: r.category ?? "",
      Note: r.notes ?? "",
    }));
    const ws = XLSX.utils.json_to_sheet(data, { header: [...EXPORT_HEADERS] });
    ws["!cols"] = EXPORT_HEADERS.map((h) => ({ wch: Math.max(14, h.length + 4) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Clienti e Fornitori");
    const filename = `clienti-fornitori_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, filename);
    toast.success(`Esportati ${target.length} record`);
  }

  function handleFileSelect(f: File | null) {
    setFile(f);
    setParsedRows(null);
    setParseError(null);
    if (!f) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const buf = e.target?.result;
        const wb = XLSX.read(buf, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });

        const KNOWN_NAME_HEADERS = ["nome", "name", "nominativo", "ragione sociale"];
        const hasNameHeader = json.length > 0 && Object.keys(json[0]).some((h) => KNOWN_NAME_HEADERS.includes(h.trim().toLowerCase()));

        const out: ImportedRow[] = [];

        if (hasNameHeader || json.length === 0) {
          for (const r of json) {
            const name = cell(r["Nome"] ?? r["Name"] ?? r["Nominativo"] ?? r["Ragione Sociale"]);
            if (!name) continue;
            out.push({
              name,
              type: normalizeType(r["Tipo"] ?? r["Type"]),
              vat: cell(r["P.IVA"] ?? r["Partita IVA"] ?? r["VAT"]),
              fiscal_code: cell(r["Codice Fiscale"] ?? r["CF"]),
              email: cell(r["Email"] ?? r["E-mail"]),
              phone: cell(r["Telefono"] ?? r["Phone"]),
              zone: cell(r["Zona"] ?? r["Area"]),
              category: cell(r["Categoria"] ?? r["Category"]),
              notes: cell(r["Note"] ?? r["Notes"]),
            });
          }
        }

        // Fallback: file senza intestazione riconoscibile (es. una sola colonna di nomi,
        // magari incollata direttamente). Trattiamo ogni riga con testo nella prima colonna
        // come un nome, includendo anche quella che sheet_to_json avrebbe scambiato per header.
        if (out.length === 0) {
          const raw = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" });
          for (const row of raw) {
            const first = Array.isArray(row) ? row[0] : row;
            const name = cell(first);
            if (!name) continue;
            out.push({
              name,
              type: "cliente",
              vat: null,
              fiscal_code: null,
              email: null,
              phone: null,
              zone: null,
              category: null,
              notes: null,
            });
          }
        }
        if (out.length === 0) {
          setParseError("Nessuna riga valida trovata. Assicurati che il file abbia una colonna 'Nome'.");
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
      toast.success(`Importati ${res.upserted} record su ${res.total}`);
      queryClient.invalidateQueries({ queryKey: ["counterparts", companyId] });
      reset();
      onOpenChange(false);
    },
    onError: (e) => toast.error("Errore import", { description: e instanceof Error ? e.message : "" }),
  });

  function reset() {
    setFile(null);
    setParsedRows(null);
    setParseError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const preview = useMemo(() => parsedRows?.slice(0, 5) ?? [], [parsedRows]);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
            Utilità Import/Export Excel
          </DialogTitle>
          <DialogDescription>
            Importa clienti e fornitori da file XLSX, XLS e ODS; export sempre in XLSX.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="export">
              <Download className="mr-2 h-4 w-4" /> Esporta
            </TabsTrigger>
            <TabsTrigger value="import">
              <Upload className="mr-2 h-4 w-4" /> Importa
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {mode === "export" ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm dark:border-emerald-900 dark:bg-emerald-950/30">
              <p className="mb-2 flex items-center gap-2 font-medium text-emerald-800 dark:text-emerald-300">
                <FileSpreadsheet className="h-4 w-4" /> Export Excel professionale
              </p>
              <ul className="space-y-1 text-emerald-700 dark:text-emerald-400">
                <li className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5" /> Tutti i campi anagrafici</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5" /> Saldi e statistiche incluse</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5" /> Formato XLSX nativo</li>
              </ul>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium">Da esportare</p>
              <RadioGroup value={scope} onValueChange={(v) => setScope(v as typeof scope)} className="flex gap-6">
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="selected" id="scope-selected" disabled={selectedCount === 0} />
                  <Label htmlFor="scope-selected" className="font-normal">Selezionati ({selectedCount})</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="all" id="scope-all" />
                  <Label htmlFor="scope-all" className="font-normal">Tutti ({rows.length})</Label>
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
                <div className="text-center text-sm text-muted-foreground">
                  Seleziona un file XLSX, XLS o ODS
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.ods"
                  className="max-w-xs text-sm"
                  onChange={(e) => handleFileSelect(e.target.files?.[0] ?? null)}
                />
                <p className="text-center text-xs text-muted-foreground">
                  Colonne riconosciute: Nome, Tipo (Cliente/Fornitore), P.IVA, Codice Fiscale, Email, Telefono, Zona, Categoria, Note.
                  Va bene anche un file con una sola colonna di nomi senza intestazione.
                </p>
              </div>
            )}

            {parseError && (
              <div className="rounded bg-destructive/10 px-3 py-2 text-xs text-destructive">{parseError}</div>
            )}

            {parsedRows && (
              <div className="space-y-3">
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm dark:border-emerald-900 dark:bg-emerald-950/30">
                  <p className="flex items-center gap-2 font-medium text-emerald-800 dark:text-emerald-300">
                    <CheckCircle2 className="h-4 w-4" /> {parsedRows.length} righe pronte per l'import
                  </p>
                </div>
                <div className="max-h-40 overflow-y-auto rounded border text-xs">
                  {preview.map((r, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 border-b px-3 py-1.5 last:border-0">
                      <span className="truncate font-medium">{r.name}</span>
                      <span className="text-muted-foreground capitalize">{r.type}</span>
                    </div>
                  ))}
                  {parsedRows.length > 5 && (
                    <div className="px-3 py-1.5 text-muted-foreground">…e altre {parsedRows.length - 5} righe</div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={reset}>
                    Scegli un altro file
                  </Button>
                  <Button
                    className="flex-1"
                    disabled={importMut.isPending}
                    onClick={() => importMut.mutate()}
                  >
                    {importMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                    Importa {parsedRows.length} record
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
