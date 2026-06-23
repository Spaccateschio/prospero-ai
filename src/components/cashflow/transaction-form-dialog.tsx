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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

import { upsertTransaction } from "@/lib/cashflow.functions";

export type TransactionDraft = {
  id?: string;
  type: "entrata" | "uscita";
  amount: string;
  date: string;
  description: string;
  category: string;
  counterpart: string;
  payment_method: string;
  is_forecast: boolean;
  recurrence: "" | "monthly" | "quarterly" | "yearly";
};

const empty = (): TransactionDraft => ({
  type: "uscita",
  amount: "",
  date: new Date().toISOString().slice(0, 10),
  description: "",
  category: "",
  counterpart: "",
  payment_method: "bonifico",
  is_forecast: false,
  recurrence: "",
});

export function TransactionFormDialog({
  open, onOpenChange, companyId, initial, categories,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  companyId: string;
  initial?: Partial<TransactionDraft> & { id?: string };
  categories: { name: string; type: string }[];
}) {
  const queryClient = useQueryClient();
  const upsert = useServerFn(upsertTransaction);
  const [draft, setDraft] = useState<TransactionDraft>(empty());

  useEffect(() => {
    if (open) setDraft({ ...empty(), ...initial });
  }, [open, initial]);

  const filteredCategories = categories.filter((c) => c.type === (draft.type === "entrata" ? "income" : "expense"));

  const mutation = useMutation({
    mutationFn: async () => {
      const amount = Number(draft.amount.replace(",", "."));
      if (!Number.isFinite(amount) || amount <= 0) throw new Error("Importo non valido");
      await upsert({
        data: {
          id: draft.id,
          company_id: companyId,
          type: draft.type,
          amount,
          date: draft.date,
          description: draft.description || null,
          category: draft.category || null,
          counterpart: draft.counterpart || null,
          payment_method: draft.payment_method || null,
          status: draft.is_forecast ? "pending" : "confirmed",
          is_forecast: draft.is_forecast,
          recurrence: draft.recurrence || null,
        },
      });
    },
    onSuccess: () => {
      toast.success(draft.id ? "Movimento aggiornato" : "Movimento aggiunto");
      queryClient.invalidateQueries({ queryKey: ["transactions", companyId] });
      queryClient.invalidateQueries({ queryKey: ["cashflow-summary", companyId] });
      queryClient.invalidateQueries({ queryKey: ["forecast", companyId] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-kpis", companyId] });
      queryClient.invalidateQueries({ queryKey: ["top-expense-cat", companyId] });
      onOpenChange(false);
    },
    onError: (err) => toast.error("Salvataggio fallito", { description: err instanceof Error ? err.message : "" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{draft.id ? "Modifica movimento" : "Nuovo movimento"}</DialogTitle>
          <DialogDescription>
            Inserisci i dettagli. Spunta "Previsionale" per movimenti pianificati ma non ancora effettuati.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={draft.type} onValueChange={(v) => setDraft({ ...draft, type: v as "entrata" | "uscita", category: "" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="entrata">Entrata</SelectItem>
                  <SelectItem value="uscita">Uscita</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Importo (€)</Label>
              <Input
                inputMode="decimal"
                value={draft.amount}
                onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
                placeholder="0,00"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Data</Label>
              <Input type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Metodo</Label>
              <Select value={draft.payment_method} onValueChange={(v) => setDraft({ ...draft, payment_method: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bonifico">Bonifico</SelectItem>
                  <SelectItem value="contanti">Contanti</SelectItem>
                  <SelectItem value="carta">Carta</SelectItem>
                  <SelectItem value="addebito">Addebito SEPA</SelectItem>
                  <SelectItem value="assegno">Assegno</SelectItem>
                  <SelectItem value="altro">Altro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Categoria</Label>
            <Select value={draft.category} onValueChange={(v) => setDraft({ ...draft, category: v })}>
              <SelectTrigger><SelectValue placeholder="Seleziona o lascia vuoto" /></SelectTrigger>
              <SelectContent>
                {filteredCategories.length === 0 && (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">Nessuna categoria — creane in Impostazioni → Categorie</div>
                )}
                {filteredCategories.map((c) => (
                  <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Controparte</Label>
            <Input
              value={draft.counterpart}
              onChange={(e) => setDraft({ ...draft, counterpart: e.target.value })}
              placeholder="Cliente / fornitore"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Descrizione</Label>
            <Textarea
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              rows={2}
            />
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <div className="text-sm font-medium">Previsionale</div>
              <div className="text-xs text-muted-foreground">Movimento pianificato, non ancora avvenuto</div>
            </div>
            <Switch checked={draft.is_forecast} onCheckedChange={(v) => setDraft({ ...draft, is_forecast: v })} />
          </div>

          <div className="space-y-1.5">
            <Label>Ricorrenza</Label>
            <Select value={draft.recurrence || "none"} onValueChange={(v) => setDraft({ ...draft, recurrence: v === "none" ? "" : v as TransactionDraft["recurrence"] })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nessuna (singolo movimento)</SelectItem>
                <SelectItem value="monthly">Mensile</SelectItem>
                <SelectItem value="quarterly">Trimestrale</SelectItem>
                <SelectItem value="yearly">Annuale</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              Se imposti una ricorrenza, il sistema proietterà automaticamente le occorrenze future nel previsionale.
            </p>
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
