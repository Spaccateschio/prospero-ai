import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import { upsertInvoice } from "@/lib/invoices.functions";

export type InvoiceDraft = {
  id?: string;
  direction: "attiva" | "passiva";
  number: string;
  counterpart_name: string;
  counterpart_vat: string;
  amount: string;
  vat_amount: string;
  total_amount: string;
  issue_date: string;
  due_date: string;
  status: "draft" | "sent" | "partially_paid" | "paid" | "cancelled";
  payment_method: string;
  notes: string;
};

const emptyDraft = (direction: "attiva" | "passiva"): InvoiceDraft => ({
  direction,
  number: "",
  counterpart_name: "",
  counterpart_vat: "",
  amount: "",
  vat_amount: "",
  total_amount: "",
  issue_date: new Date().toISOString().slice(0, 10),
  due_date: "",
  status: "sent",
  payment_method: "bonifico",
  notes: "",
});

function parseNum(v: string): number {
  return Number(v.replace(",", "."));
}

export function InvoiceFormDialog({
  open, onOpenChange, companyId, direction, initial,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  companyId: string;
  direction: "attiva" | "passiva";
  initial?: Partial<InvoiceDraft> & { id?: string };
}) {
  const queryClient = useQueryClient();
  const upsert = useServerFn(upsertInvoice);
  const [draft, setDraft] = useState<InvoiceDraft>(emptyDraft(direction));

  useEffect(() => {
    if (open) setDraft({ ...emptyDraft(direction), ...initial });
  }, [open, initial, direction]);

  // Auto-compute total when imponibile + iva change (only if total empty or matches old sum)
  useEffect(() => {
    const a = parseNum(draft.amount);
    const v = draft.vat_amount ? parseNum(draft.vat_amount) : 0;
    if (Number.isFinite(a) && a > 0) {
      const expected = (a + (Number.isFinite(v) ? v : 0)).toFixed(2);
      if (!draft.total_amount || draft.total_amount === "0" || draft.total_amount === "0.00") {
        setDraft((d) => ({ ...d, total_amount: expected }));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.amount, draft.vat_amount]);

  const mutation = useMutation({
    mutationFn: async () => {
      const amount = parseNum(draft.amount);
      const total = parseNum(draft.total_amount);
      const vat = draft.vat_amount ? parseNum(draft.vat_amount) : null;
      if (!Number.isFinite(amount) || amount < 0) throw new Error("Imponibile non valido");
      if (!Number.isFinite(total) || total <= 0) throw new Error("Totale non valido");
      if (!draft.counterpart_name.trim()) throw new Error("Inserisci la controparte");
      await upsert({
        data: {
          id: draft.id,
          company_id: companyId,
          direction: draft.direction,
          number: draft.number || null,
          counterpart_name: draft.counterpart_name.trim(),
          counterpart_vat: draft.counterpart_vat || null,
          amount,
          vat_amount: vat,
          total_amount: total,
          issue_date: draft.issue_date || null,
          due_date: draft.due_date || null,
          status: draft.status,
          payment_method: draft.payment_method || null,
          notes: draft.notes || null,
        },
      });
    },
    onSuccess: () => {
      toast.success(draft.id ? "Fattura aggiornata" : "Fattura creata");
      queryClient.invalidateQueries({ queryKey: ["invoices", companyId] });
      queryClient.invalidateQueries({ queryKey: ["cashflow-summary", companyId] });
      queryClient.invalidateQueries({ queryKey: ["forecast", companyId] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-kpis", companyId] });
      onOpenChange(false);
    },
    onError: (e) => toast.error("Salvataggio fallito", { description: e instanceof Error ? e.message : "" }),
  });

  const directionLabel = direction === "attiva" ? "attiva" : "passiva";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{draft.id ? `Modifica fattura ${directionLabel}` : `Nuova fattura ${directionLabel}`}</DialogTitle>
          <DialogDescription>
            {direction === "attiva" ? "Fattura emessa verso un cliente." : "Fattura ricevuta da un fornitore."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Numero</Label>
              <Input value={draft.number} onChange={(e) => setDraft({ ...draft, number: e.target.value })} placeholder="2025/0001" />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>{direction === "attiva" ? "Cliente" : "Fornitore"}</Label>
              <Input
                value={draft.counterpart_name}
                onChange={(e) => setDraft({ ...draft, counterpart_name: e.target.value })}
                placeholder="Ragione sociale"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>P.IVA controparte</Label>
              <Input value={draft.counterpart_vat} onChange={(e) => setDraft({ ...draft, counterpart_vat: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Imponibile (€)</Label>
              <Input inputMode="decimal" value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>IVA (€)</Label>
              <Input inputMode="decimal" value={draft.vat_amount} onChange={(e) => setDraft({ ...draft, vat_amount: e.target.value })} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Totale (€)</Label>
              <Input inputMode="decimal" value={draft.total_amount} onChange={(e) => setDraft({ ...draft, total_amount: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Data emissione</Label>
              <Input type="date" value={draft.issue_date} onChange={(e) => setDraft({ ...draft, issue_date: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Scadenza</Label>
              <Input type="date" value={draft.due_date} onChange={(e) => setDraft({ ...draft, due_date: e.target.value })} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Stato</Label>
              <Select value={draft.status} onValueChange={(v) => setDraft({ ...draft, status: v as InvoiceDraft["status"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Bozza</SelectItem>
                  <SelectItem value="sent">Emessa / da pagare</SelectItem>
                  <SelectItem value="partially_paid">Parzialmente pagata</SelectItem>
                  <SelectItem value="paid">Pagata</SelectItem>
                  <SelectItem value="cancelled">Annullata</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                "Scaduta" è calcolato in automatico se la data di scadenza è passata.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Metodo di pagamento</Label>
              <Select value={draft.payment_method} onValueChange={(v) => setDraft({ ...draft, payment_method: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bonifico">Bonifico</SelectItem>
                  <SelectItem value="ri.ba">Ri.Ba.</SelectItem>
                  <SelectItem value="addebito">Addebito SEPA</SelectItem>
                  <SelectItem value="carta">Carta</SelectItem>
                  <SelectItem value="contanti">Contanti</SelectItem>
                  <SelectItem value="assegno">Assegno</SelectItem>
                  <SelectItem value="altro">Altro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Note</Label>
            <Textarea value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Annulla</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salva
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
