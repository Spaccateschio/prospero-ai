import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Upload, Loader2, AlertCircle, ArrowUpDown, ArrowUp, ArrowDown,
  Pencil, Copy, Trash2, CheckCircle2, MoreHorizontal,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { useActiveCompany } from "@/hooks/use-companies";
import { formatEUR, formatDate } from "@/lib/format";
import { listInvoices, upsertInvoice, deleteInvoice, recordInvoicePayment } from "@/lib/invoices.functions";
import { PdfImportDialog } from "@/components/documents/pdf-import-dialog";
import { InvoiceFormDialog, type InvoiceDraft } from "@/components/invoices/invoice-form-dialog";

type Row = {
  id: string;
  number: string | null;
  document_type: string;
  counterpart_name: string;
  counterpart_vat: string | null;
  issue_date: string | null;
  due_date: string | null;
  amount: number;
  vat_amount: number | null;
  total_amount: number;
  paid_amount: number;
  payment_method: string | null;
  notes: string | null;
  effective_status: string;
};

type SortKey = "number" | "issue_date" | "counterpart_name" | "total_amount" | "effective_status";
type SortDir = "asc" | "desc";

/** Estrae la parte numerica iniziale di un numero documento tipo "12/D" -> 12, "1/B" -> 1 */
function numericPrefix(n: string | null): number {
  if (!n) return Number.POSITIVE_INFINITY;
  const m = n.match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : Number.POSITIVE_INFINITY;
}

export function DocsList({
  direction,
  mode,
  title,
}: {
  direction: "attiva" | "passiva";
  mode: "sales" | "purchases" | "other";
  title: string;
}) {
  const { activeId, active, isLoading } = useActiveCompany();
  const queryClient = useQueryClient();
  const [importOpen, setImportOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>("issue_date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [editRow, setEditRow] = useState<Row | null | "new">(null);
  const [duplicateFrom, setDuplicateFrom] = useState<Row | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Row | "bulk" | null>(null);

  const fetchInvoices = useServerFn(listInvoices);
  const upsert = useServerFn(upsertInvoice);
  const remove = useServerFn(deleteInvoice);
  const recordPayment = useServerFn(recordInvoicePayment);

  const { data: rows, isLoading: loadingRows } = useQuery({
    queryKey: ["invoices", activeId, direction, mode],
    queryFn: async () => {
      if (!activeId) return [];
      return (await fetchInvoices({ data: { company_id: activeId, direction } })) as unknown as Row[];
    },
    enabled: !!activeId,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["invoices", activeId] });

  const filtered = mode === "other"
    ? (rows ?? []).filter((r) => r.document_type !== "fattura")
    : (rows ?? []);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const dir = sortDir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      switch (sortKey) {
        case "number":
          return (numericPrefix(a.number) - numericPrefix(b.number)) * dir;
        case "issue_date":
          return ((a.issue_date ?? "") < (b.issue_date ?? "") ? -1 : (a.issue_date ?? "") > (b.issue_date ?? "") ? 1 : 0) * dir;
        case "counterpart_name":
          return a.counterpart_name.localeCompare(b.counterpart_name) * dir;
        case "total_amount":
          return (Number(a.total_amount) - Number(b.total_amount)) * dir;
        case "effective_status":
          return a.effective_status.localeCompare(b.effective_status) * dir;
        default:
          return 0;
      }
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const total = filtered.reduce((s, r) => s + Number(r.total_amount || 0), 0);
  const selectedRows = sorted.filter((r) => selected.has(r.id));
  const selectedOpenTotal = selectedRows.reduce(
    (s, r) => s + Math.max(0, Number(r.total_amount) - Number(r.paid_amount ?? 0)),
    0,
  );

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function SortIcon({ column }: { column: SortKey }) {
    if (sortKey !== column) return <ArrowUpDown className="ml-1 h-3 w-3 text-muted-foreground/50" />;
    return sortDir === "asc" ? <ArrowUp className="ml-1 h-3 w-3" /> : <ArrowDown className="ml-1 h-3 w-3" />;
  }

  function toggleAll() {
    if (selected.size === sorted.length) setSelected(new Set());
    else setSelected(new Set(sorted.map((r) => r.id)));
  }
  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const duplicateMut = useMutation({
    mutationFn: (r: Row) =>
      upsert({
        data: {
          company_id: activeId!,
          direction,
          number: r.number ? `${r.number} (copia)` : null,
          counterpart_name: r.counterpart_name,
          counterpart_vat: r.counterpart_vat,
          amount: Number(r.amount ?? r.total_amount),
          vat_amount: r.vat_amount,
          total_amount: Number(r.total_amount),
          issue_date: r.issue_date,
          due_date: r.due_date,
          status: "draft",
          payment_method: r.payment_method,
          notes: r.notes,
        },
      }),
    onSuccess: () => {
      toast.success("Documento duplicato");
      invalidate();
    },
    onError: (e) => toast.error("Errore duplicazione", { description: e instanceof Error ? e.message : "" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => remove({ data: { id, company_id: activeId! } }),
    onSuccess: () => invalidate(),
    onError: (e) => toast.error("Errore eliminazione", { description: e instanceof Error ? e.message : "" }),
  });

  const bulkDeleteMut = useMutation({
    mutationFn: async (ids: string[]) => {
      for (const id of ids) {
        await remove({ data: { id, company_id: activeId! } });
      }
    },
    onSuccess: () => {
      toast.success("Documenti eliminati");
      setSelected(new Set());
      setDeleteTarget(null);
      invalidate();
    },
    onError: (e) => toast.error("Errore eliminazione multipla", { description: e instanceof Error ? e.message : "" }),
  });

  const bulkSettleMut = useMutation({
    mutationFn: async (rowsToSettle: Row[]) => {
      const today = new Date().toISOString().slice(0, 10);
      for (const r of rowsToSettle) {
        const remaining = Math.max(0, Number(r.total_amount) - Number(r.paid_amount ?? 0));
        if (remaining <= 0) continue;
        await recordPayment({
          data: {
            invoice_id: r.id,
            company_id: activeId!,
            amount: remaining,
            payment_date: today,
            create_movement: true,
          },
        });
      }
    },
    onSuccess: () => {
      toast.success(`${selectedRows.length} documenti saldati`);
      setSelected(new Set());
      invalidate();
      queryClient.invalidateQueries({ queryKey: ["financial_resources", activeId] });
    },
    onError: (e) => toast.error("Errore saldo multiplo", { description: e instanceof Error ? e.message : "" }),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    );
  }
  if (!activeId || !active) {
    return (
      <div className="p-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Nessuna azienda selezionata</AlertTitle>
          <AlertDescription>Crea o seleziona un'azienda per gestire i documenti.</AlertDescription>
        </Alert>
      </div>
    );
  }

  const editingInitial: (Partial<InvoiceDraft> & { id?: string }) | undefined =
    editRow && editRow !== "new"
      ? {
          id: editRow.id,
          number: editRow.number ?? "",
          counterpart_name: editRow.counterpart_name,
          counterpart_vat: editRow.counterpart_vat ?? "",
          amount: String(editRow.amount ?? editRow.total_amount ?? ""),
          vat_amount: editRow.vat_amount != null ? String(editRow.vat_amount) : "",
          total_amount: String(editRow.total_amount ?? ""),
          issue_date: editRow.issue_date ?? "",
          due_date: editRow.due_date ?? "",
          status: (editRow.effective_status as InvoiceDraft["status"]) ?? "sent",
          payment_method: editRow.payment_method ?? "bonifico",
          notes: editRow.notes ?? "",
        }
      : duplicateFrom
      ? {
          number: duplicateFrom.number ? `${duplicateFrom.number} (copia)` : "",
          counterpart_name: duplicateFrom.counterpart_name,
          counterpart_vat: duplicateFrom.counterpart_vat ?? "",
          amount: String(duplicateFrom.amount ?? duplicateFrom.total_amount ?? ""),
          vat_amount: duplicateFrom.vat_amount != null ? String(duplicateFrom.vat_amount) : "",
          total_amount: String(duplicateFrom.total_amount ?? ""),
          issue_date: new Date().toISOString().slice(0, 10),
          due_date: "",
          status: "draft",
          payment_method: duplicateFrom.payment_method ?? "bonifico",
          notes: duplicateFrom.notes ?? "",
        }
      : undefined;

  return (
    <div className="space-y-6 p-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">{title}</h1>
          <p className="text-sm text-muted-foreground">
            {active.company.name} · {filtered.length} documenti · {formatEUR(total)}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { setDuplicateFrom(null); setEditRow("new"); }}>
            <Pencil className="mr-2 h-4 w-4" /> Nuovo documento
          </Button>
          <Button onClick={() => setImportOpen(true)}>
            <Upload className="mr-2 h-4 w-4" /> Importa da PDF
          </Button>
        </div>
      </header>

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-md border bg-muted/40 px-4 py-2.5 text-sm">
          <span className="font-medium">{selected.size} selezionati</span>
          <span className="text-muted-foreground">
            Saldo aperto selezione: <span className="font-medium text-foreground">{formatEUR(selectedOpenTotal)}</span>
          </span>
          <div className="ml-auto flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={bulkSettleMut.isPending || selectedOpenTotal <= 0}
              onClick={() => bulkSettleMut.mutate(selectedRows)}
            >
              <CheckCircle2 className="mr-2 h-3.5 w-3.5" /> Segna come saldate
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setDeleteTarget("bulk")}
            >
              <Trash2 className="mr-2 h-3.5 w-3.5" /> Elimina selezionati
            </Button>
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Elenco documenti</CardTitle>
          <CardDescription>
            Carica un PDF (fattura singola o elenco) e l'AI estrae automaticamente tutti i campi. Clicca sulle intestazioni per ordinare, seleziona le righe per azioni multiple.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingRows ? (
            <div className="flex h-32 items-center justify-center text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : sorted.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center gap-3 text-center text-sm text-muted-foreground">
              <p>Nessun documento. Importa il tuo primo PDF per iniziare.</p>
              <Button size="sm" onClick={() => setImportOpen(true)}>
                <Upload className="mr-2 h-4 w-4" /> Importa PDF
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={selected.size > 0 && selected.size === sorted.length}
                        onCheckedChange={toggleAll}
                        aria-label="Seleziona tutto"
                      />
                    </TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("number")}>
                      <span className="flex items-center">Numero <SortIcon column="number" /></span>
                    </TableHead>
                    <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("issue_date")}>
                      <span className="flex items-center">Data <SortIcon column="issue_date" /></span>
                    </TableHead>
                    <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("counterpart_name")}>
                      <span className="flex items-center">
                        {direction === "attiva" ? "Cliente" : "Fornitore"} <SortIcon column="counterpart_name" />
                      </span>
                    </TableHead>
                    <TableHead className="cursor-pointer select-none text-right" onClick={() => toggleSort("total_amount")}>
                      <span className="flex items-center justify-end">Totale <SortIcon column="total_amount" /></span>
                    </TableHead>
                    <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("effective_status")}>
                      <span className="flex items-center">Stato <SortIcon column="effective_status" /></span>
                    </TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.map((r) => (
                    <TableRow key={r.id} data-state={selected.has(r.id) ? "selected" : undefined}>
                      <TableCell>
                        <Checkbox
                          checked={selected.has(r.id)}
                          onCheckedChange={() => toggleOne(r.id)}
                          aria-label={`Seleziona ${r.counterpart_name}`}
                        />
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {r.document_type.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{r.number ?? "—"}</TableCell>
                      <TableCell>{formatDate(r.issue_date)}</TableCell>
                      <TableCell className="font-medium">{r.counterpart_name}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatEUR(Number(r.total_amount))}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">
                          {r.effective_status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => { setDuplicateFrom(null); setEditRow(r); }}>
                              <Pencil className="mr-2 h-3.5 w-3.5" /> Modifica
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => duplicateMut.mutate(r)}>
                              <Copy className="mr-2 h-3.5 w-3.5" /> Duplica
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => setDeleteTarget(r)}
                            >
                              <Trash2 className="mr-2 h-3.5 w-3.5" /> Elimina
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <PdfImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        companyId={activeId}
        mode={mode}
      />

      <InvoiceFormDialog
        open={editRow !== null}
        onOpenChange={(v) => { if (!v) { setEditRow(null); setDuplicateFrom(null); } }}
        companyId={activeId}
        direction={direction}
        initial={editingInitial}
      />

      <AlertDialog open={deleteTarget !== null} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteTarget === "bulk"
                ? `Eliminare ${selected.size} documenti?`
                : `Eliminare il documento ${deleteTarget ? (deleteTarget.number ?? "") : ""}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Questa azione non può essere annullata.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteTarget === "bulk") bulkDeleteMut.mutate(Array.from(selected));
                else if (deleteTarget) {
                  deleteMut.mutate(deleteTarget.id);
                  setDeleteTarget(null);
                }
              }}
            >
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
