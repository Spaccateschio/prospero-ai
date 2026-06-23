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

import { upsertLoan } from "@/lib/loans.functions";

export type LoanDraft = {
  id?: string;
  name: string;
  lender: string;
  initial_amount: string;
  rate_type: "fisso" | "variabile" | "misto";
  rate_value: string;
  installment: string;
  total_installments: string;
  frequency: "monthly" | "quarterly" | "yearly";
  start_date: string;
  next_due_date: string;
  notes: string;
};

const emptyDraft = (): LoanDraft => ({
  name: "",
  lender: "",
  initial_amount: "",
  rate_type: "fisso",
  rate_value: "",
  installment: "",
  total_installments: "",
  frequency: "monthly",
  start_date: new Date().toISOString().slice(0, 10),
  next_due_date: "",
  notes: "",
});

function parseNum(v: string): number {
  return Number(v.replace(",", "."));
}

export function LoanFormDialog({
  open, onOpenChange, companyId, initial,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  companyId: string;
  initial?: Partial<LoanDraft> & { id?: string };
}) {
  const queryClient = useQueryClient();
  const upsert = useServerFn(upsertLoan);
  const [draft, setDraft] = useState<LoanDraft>(emptyDraft());

  useEffect(() => {
    if (open) setDraft({ ...emptyDraft(), ...initial });
  }, [open, initial]);

  const mutation = useMutation({
    mutationFn: async () => {
      const initialAmount = parseNum(draft.initial_amount);
      const installment = parseNum(draft.installment);
      const total = parseInt(draft.total_installments, 10);
      const rate = draft.rate_value ? parseNum(draft.rate_value) : null;
      if (!draft.name.trim()) throw new Error("Inserisci il nome del finanziamento");
      if (!Number.isFinite(initialAmount) || initialAmount <= 0) throw new Error("Importo iniziale non valido");
      if (!Number.isFinite(installment) || installment <= 0) throw new Error("Rata non valida");
      if (!Number.isFinite(total) || total <= 0) throw new Error("Numero rate non valido");
      await upsert({
        data: {
          id: draft.id,
          company_id: companyId,
          name: draft.name.trim(),
          lender: draft.lender || null,
          initial_amount: initialAmount,
          rate_type: draft.rate_type,
          rate_value: rate,
          installment,
          total_installments: total,
          frequency: draft.frequency,
          start_date: draft.start_date || null,
          next_due_date: draft.next_due_date || null,
          notes: draft.notes || null,
        },
      });
    },
    onSuccess: () => {
      toast.success(draft.id ? "Finanziamento aggiornato" : "Finanziamento creato");
      queryClient.invalidateQueries({ queryKey: ["loans", companyId] });
      queryClient.invalidateQueries({ queryKey: ["cashflow-summary", companyId] });
      queryClient.invalidateQueries({ queryKey: ["forecast", companyId] });
      onOpenChange(false);
    },
    onError: (e) => toast.error("Salvataggio fallito", { description: e instanceof Error ? e.message : "" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{draft.id ? "Modifica finanziamento" : "Nuovo finanziamento"}</DialogTitle>
          <DialogDescription>
            Inserisci i parametri del piano di ammortamento. Il residuo è calcolato in modo proporzionale alle rate pagate.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Mutuo immobile, Leasing furgone…" />
            </div>
            <div className="space-y-1.5">
              <Label>Ente erogante</Label>
              <Input value={draft.lender} onChange={(e) => setDraft({ ...draft, lender: e.target.value })} placeholder="Banca / Società di leasing" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Importo iniziale (€)</Label>
              <Input inputMode="decimal" value={draft.initial_amount} onChange={(e) => setDraft({ ...draft, initial_amount: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Rata (€)</Label>
              <Input inputMode="decimal" value={draft.installment} onChange={(e) => setDraft({ ...draft, installment: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Numero rate</Label>
              <Input inputMode="numeric" value={draft.total_installments} onChange={(e) => setDraft({ ...draft, total_installments: e.target.value })} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Frequenza</Label>
              <Select value={draft.frequency} onValueChange={(v) => setDraft({ ...draft, frequency: v as LoanDraft["frequency"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Mensile</SelectItem>
                  <SelectItem value="quarterly">Trimestrale</SelectItem>
                  <SelectItem value="yearly">Annuale</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Tipo tasso</Label>
              <Select value={draft.rate_type} onValueChange={(v) => setDraft({ ...draft, rate_type: v as LoanDraft["rate_type"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fisso">Fisso</SelectItem>
                  <SelectItem value="variabile">Variabile</SelectItem>
                  <SelectItem value="misto">Misto</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Tasso (%)</Label>
              <Input inputMode="decimal" value={draft.rate_value} onChange={(e) => setDraft({ ...draft, rate_value: e.target.value })} placeholder="es. 4,25" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Data inizio</Label>
              <Input type="date" value={draft.start_date} onChange={(e) => setDraft({ ...draft, start_date: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Prossima scadenza</Label>
              <Input type="date" value={draft.next_due_date} onChange={(e) => setDraft({ ...draft, next_due_date: e.target.value })} />
              <p className="text-[11px] text-muted-foreground">Se vuoto, calcolata automaticamente dalla data di inizio.</p>
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
