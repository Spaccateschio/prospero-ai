import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Upload, FileText, Trash2 } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { formatEUR } from "@/lib/format";

import {
  extractDocumentsFromPdf,
  bulkSaveInvoices,
  saveTaxPayment,
  type ExtractedInvoice,
} from "@/lib/documents.functions";

type Mode = "sales" | "purchases" | "other";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  companyId: string;
  mode: Mode;
};

async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }
  return btoa(binary);
}

export function PdfImportDialog({ open, onOpenChange, companyId, mode }: Props) {
  const queryClient = useQueryClient();
  const extract = useServerFn(extractDocumentsFromPdf);
  const bulkSave = useServerFn(bulkSaveInvoices);
  const saveTax = useServerFn(saveTaxPayment);

  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<(ExtractedInvoice & { _selected: boolean })[]>([]);
  const [taxRows, setTaxRows] = useState<
    Array<{
      _selected: boolean;
      payment_date: string;
      total_amount: number;
      protocol: string | null;
      sections: unknown[];
    }>
  >([]);
  const [summary, setSummary] = useState<string>("");

  const hintDirection: "attiva" | "passiva" | undefined =
    mode === "sales" ? "attiva" : mode === "purchases" ? "passiva" : undefined;

  const extractMut = useMutation({
    mutationFn: async (f: File) => {
      const b64 = await fileToBase64(f);
      return extract({
        data: {
          pdf_base64: b64,
          filename: f.name,
          hint_direction: hintDirection,
        },
      });
    },
    onSuccess: (res) => {
      if (res.status === "error") {
        toast.error(res.message);
        return;
      }
      let invs = res.invoices;
      if (mode === "sales") invs = invs.filter((i) => i.direction === "attiva");
      if (mode === "purchases") invs = invs.filter((i) => i.direction === "passiva");
      setRows(invs.map((i) => ({ ...i, _selected: true })));
      setTaxRows(
        res.tax_payments.map((t) => ({
          _selected: mode === "other",
          payment_date: t.payment_date,
          total_amount: t.total_amount,
          protocol: t.protocol,
          sections: t.sections,
        })),
      );
      setSummary(res.summary);
      toast.success(`Estratti: ${invs.length} documenti${res.tax_payments.length > 0 ? `, ${res.tax_payments.length} F24` : ""}`);
    },
    onError: (e) => toast.error("Estrazione fallita", { description: e instanceof Error ? e.message : "" }),
  });

  const saveMut = useMutation({
    mutationFn: async () => {
      const selectedInvoices = rows.filter((r) => r._selected && r.total_amount > 0 && r.counterpart_name.trim() !== "");
      const selectedTax = taxRows.filter((t) => t._selected);
      let savedInv = 0;
      let savedTax = 0;
      if (selectedInvoices.length > 0) {
        const res = await bulkSave({
          data: {
            company_id: companyId,
            items: selectedInvoices.map((r) => ({
              document_type: r.document_type,
              direction: r.direction,
              number: r.number,
              counterpart_name: r.counterpart_name,
              counterpart_vat: r.counterpart_vat,
              issue_date: r.issue_date,
              due_date: r.due_date,
              amount: r.amount,
              vat_amount: r.vat_amount,
              total_amount: r.total_amount,
            })),
          },
        });
        savedInv = res.inserted;
      }
      for (const t of selectedTax) {
        await saveTax({
          data: {
            company_id: companyId,
            payment_date: t.payment_date,
            total_amount: t.total_amount,
            protocol: t.protocol,
            sections: t.sections as never,
            notes: null,
          },
        });
        savedTax++;
      }
      return { savedInv, savedTax };
    },
    onSuccess: ({ savedInv, savedTax }) => {
      toast.success(`Salvati ${savedInv} documenti${savedTax > 0 ? ` e ${savedTax} F24` : ""}`);
      queryClient.invalidateQueries({ queryKey: ["invoices", companyId] });
      queryClient.invalidateQueries({ queryKey: ["tax_payments", companyId] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      reset();
      onOpenChange(false);
    },
    onError: (e) => toast.error("Salvataggio fallito", { description: e instanceof Error ? e.message : "" }),
  });

  function reset() {
    setFile(null);
    setRows([]);
    setTaxRows([]);
    setSummary("");
  }

  const allSelected = rows.length > 0 && rows.every((r) => r._selected);
  const totalSelected = rows.filter((r) => r._selected).length;
  const totalAmount = rows
    .filter((r) => r._selected)
    .reduce((s, r) => s + Number(r.total_amount || 0), 0);

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Importa {mode === "sales" ? "fatture emesse" : mode === "purchases" ? "fatture ricevute" : "documenti"} da PDF
          </DialogTitle>
          <DialogDescription>
            Carica un PDF (fattura singola, elenco tabellare, F24, parcella…). L'AI estrae i campi, tu confermi cosa salvare.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {rows.length === 0 && taxRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8">
              <FileText className="h-10 w-10 text-muted-foreground" />
              <div className="text-center text-sm text-muted-foreground">
                Seleziona un PDF (max ~14MB)
              </div>
              <Input
                type="file"
                accept="application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="max-w-sm"
              />
              {file && (
                <Button
                  onClick={() => file && extractMut.mutate(file)}
                  disabled={extractMut.isPending}
                >
                  {extractMut.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Estrazione in corso…
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" /> Analizza {file.name}
                    </>
                  )}
                </Button>
              )}
            </div>
          ) : (
            <>
              {summary && (
                <div className="rounded-md bg-muted/50 px-3 py-2 text-sm text-muted-foreground">{summary}</div>
              )}

              {rows.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">
                      Documenti rilevati ({totalSelected}/{rows.length} selezionati ·{" "}
                      <span className="font-semibold">{formatEUR(totalAmount)}</span>)
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setRows((rs) => rs.map((r) => ({ ...r, _selected: !allSelected })))}
                    >
                      {allSelected ? "Deseleziona tutti" : "Seleziona tutti"}
                    </Button>
                  </div>
                  <div className="overflow-x-auto rounded border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-8"></TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Dir.</TableHead>
                          <TableHead>Numero</TableHead>
                          <TableHead>Data</TableHead>
                          <TableHead>Controparte</TableHead>
                          <TableHead className="text-right">Totale</TableHead>
                          <TableHead className="w-8"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rows.map((r, i) => (
                          <TableRow key={i} className={r._selected ? "" : "opacity-40"}>
                            <TableCell>
                              <Checkbox
                                checked={r._selected}
                                onCheckedChange={(v) =>
                                  setRows((rs) =>
                                    rs.map((row, idx) => (idx === i ? { ...row, _selected: !!v } : row)),
                                  )
                                }
                              />
                            </TableCell>
                            <TableCell>
                              <Select
                                value={r.document_type}
                                onValueChange={(v) =>
                                  setRows((rs) =>
                                    rs.map((row, idx) =>
                                      idx === i
                                        ? { ...row, document_type: v as ExtractedInvoice["document_type"] }
                                        : row,
                                    ),
                                  )
                                }
                              >
                                <SelectTrigger className="h-7 w-[110px] text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="fattura">Fattura</SelectItem>
                                  <SelectItem value="parcella">Parcella</SelectItem>
                                  <SelectItem value="nota_credito">Nota credito</SelectItem>
                                  <SelectItem value="ricevuta">Ricevuta</SelectItem>
                                  <SelectItem value="ddt">DDT</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Badge variant={r.direction === "attiva" ? "default" : "secondary"}>
                                {r.direction === "attiva" ? "Att" : "Pas"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Input
                                value={r.number ?? ""}
                                onChange={(e) =>
                                  setRows((rs) =>
                                    rs.map((row, idx) => (idx === i ? { ...row, number: e.target.value || null } : row)),
                                  )
                                }
                                className="h-7 w-24 text-xs"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="date"
                                value={r.issue_date ?? ""}
                                onChange={(e) =>
                                  setRows((rs) =>
                                    rs.map((row, idx) =>
                                      idx === i ? { ...row, issue_date: e.target.value || null } : row,
                                    ),
                                  )
                                }
                                className="h-7 w-32 text-xs"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                value={r.counterpart_name}
                                onChange={(e) =>
                                  setRows((rs) =>
                                    rs.map((row, idx) =>
                                      idx === i ? { ...row, counterpart_name: e.target.value } : row,
                                    ),
                                  )
                                }
                                className="h-7 min-w-[200px] text-xs"
                              />
                            </TableCell>
                            <TableCell className="text-right">
                              <Input
                                type="number"
                                step="0.01"
                                value={r.total_amount}
                                onChange={(e) =>
                                  setRows((rs) =>
                                    rs.map((row, idx) =>
                                      idx === i
                                        ? { ...row, total_amount: Number(e.target.value) || 0 }
                                        : row,
                                    ),
                                  )
                                }
                                className="h-7 w-28 text-right text-xs tabular-nums"
                              />
                            </TableCell>
                            <TableCell>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => setRows((rs) => rs.filter((_, idx) => idx !== i))}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {taxRows.length > 0 && (
                <div className="space-y-2">
                  <div className="text-sm font-medium">F24 rilevati ({taxRows.length})</div>
                  <div className="overflow-x-auto rounded border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-8"></TableHead>
                          <TableHead>Data versamento</TableHead>
                          <TableHead>Protocollo</TableHead>
                          <TableHead>Sezioni</TableHead>
                          <TableHead className="text-right">Totale</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {taxRows.map((t, i) => (
                          <TableRow key={i} className={t._selected ? "" : "opacity-40"}>
                            <TableCell>
                              <Checkbox
                                checked={t._selected}
                                onCheckedChange={(v) =>
                                  setTaxRows((rs) =>
                                    rs.map((row, idx) => (idx === i ? { ...row, _selected: !!v } : row)),
                                  )
                                }
                              />
                            </TableCell>
                            <TableCell>{t.payment_date}</TableCell>
                            <TableCell className="text-xs">{t.protocol ?? "—"}</TableCell>
                            <TableCell className="text-xs">{(t.sections as unknown[]).length}</TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatEUR(t.total_amount)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          {rows.length > 0 || taxRows.length > 0 ? (
            <>
              <Button variant="outline" onClick={reset}>
                Carica un altro PDF
              </Button>
              <Button
                onClick={() => saveMut.mutate()}
                disabled={saveMut.isPending || (totalSelected === 0 && taxRows.filter((t) => t._selected).length === 0)}
              >
                {saveMut.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvataggio…
                  </>
                ) : (
                  `Salva ${totalSelected + taxRows.filter((t) => t._selected).length} documenti`
                )}
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Annulla
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
