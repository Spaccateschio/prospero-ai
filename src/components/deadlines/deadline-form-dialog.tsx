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

import { upsertDeadline } from "@/lib/deadlines.functions";

export type DeadlineKind = "tax" | "contract" | "payment" | "admin" | "other";

export type DeadlineDraft = {
  id?: string;
  kind: DeadlineKind;
  category: string;
  title: string;
  description: string;
  due_date: string;
  estimated_amount: string;
  confidence: "high" | "medium" | "low";
  status: "pending" | "paid" | "cancelled";
  notify_days_before: string;
  recurrence: "" | "monthly" | "quarterly" | "yearly";
};

// Categorie predefinite per kind='tax'
export const TAX_CATEGORIES = ["IVA", "F24", "IRES", "IRAP", "IRPEF", "INPS", "INAIL", "IMU", "TARI", "Altro"];
// Categorie predefinite per kind diverso da tax
export const OTHER_CATEGORIES = ["Contratto", "Pagamento", "Adempimento", "Bollo", "Assicurazione", "Affitto", "Utenza", "Altro"];

const emptyDraft = (kind: DeadlineKind): DeadlineDraft => ({
  kind,
  category: kind === "tax" ? "IVA" : "Pagamento",
  title: "",
  description: "",
  due_date: new Date().toISOString().slice(0, 10),
  estimated_amount: "",
  confidence: "medium",
  status: "pending",
  notify_days_before: "7",
  recurrence: "",
});

export function DeadlineFormDialog({
  open, onOpenChange, companyId, defaultKind, initial,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  companyId: string;
  defaultKind: DeadlineKind;
  initial?: Partial<DeadlineDraft> & { id?: string };
}) {
  const queryClient = useQueryClient();
  const upsert = useServerFn(upsertDeadline);
  const [draft, setDraft] = useState<DeadlineDraft>(emptyDraft(defaultKind));

  useEffect(() => {
    if (open) setDraft({ ...emptyDraft(defaultKind), ...initial });
  }, [open, initial, defaultKind]);

  const isTax = draft.kind === "tax";
  const categories = isTax ? TAX_CATEGORIES : OTHER_CATEGORIES;

  const mutation = useMutation({
    mutationFn: async () => {
      if (!draft.title.trim()) throw new Error("Inserisci un titolo");
      if (!draft.due_date) throw new Error("Inserisci la scadenza");
      const est = draft.estimated_amount ? Number(draft.estimated_amount.replace(",", ".")) : null;
      if (est !== null && (!Number.isFinite(est) || est < 0)) throw new Error("Importo stimato non valido");
      const notify = Number(draft.notify_days_before);
      await upsert({
        data: {
          id: draft.id,
          company_id: companyId,
          kind: draft.kind,
          category: draft.category || null,
          title: draft.title.trim(),
          description: draft.description || null,
          due_date: draft.due_date,
          estimated_amount: est,
          actual_amount: null,
          confidence: draft.confidence,
          status: draft.status,
          notify_days_before: Number.isFinite(notify) ? notify : 7,
          recurrence: draft.recurrence ? draft.recurrence : null,
        },
      });
    },
    onSuccess: () => {
      toast.success(draft.id ? "Scadenza aggiornata" : "Scadenza creata");
      queryClient.invalidateQueries({ queryKey: ["deadlines", companyId] });
      queryClient.invalidateQueries({ queryKey: ["forecast", companyId] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-kpis", companyId] });
      onOpenChange(false);
    },
    onError: (e) => toast.error("Salvataggio fallito", { description: e instanceof Error ? e.message : "" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{draft.id ? "Modifica scadenza" : isTax ? "Nuova scadenza fiscale" : "Nuova scadenza"}</DialogTitle>
          <DialogDescription>
            {isTax
              ? "Imposte e contributi (IVA, F24, IRES, IRAP, INPS, …)."
              : "Contratti, pagamenti ricorrenti, adempimenti amministrativi."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Tipologia</Label>
              <Select
                value={draft.kind}
                onValueChange={(v) => {
                  const k = v as DeadlineKind;
                  setDraft({ ...draft, kind: k, category: k === "tax" ? "IVA" : "Pagamento" });
                }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="tax">Fiscale</SelectItem>
                  <SelectItem value="contract">Contratto</SelectItem>
                  <SelectItem value="payment">Pagamento</SelectItem>
                  <SelectItem value="admin">Amministrativa</SelectItem>
                  <SelectItem value="other">Altro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>{isTax ? "Tipo (IVA, F24…)" : "Categoria"}</Label>
              <Select value={draft.category} onValueChange={(v) => setDraft({ ...draft, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Scadenza</Label>
              <Input type="date" value={draft.due_date} onChange={(e) => setDraft({ ...draft, due_date: e.target.value })} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Titolo</Label>
            <Input
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder={isTax ? "Es. IVA trimestre Q3 2025" : "Es. Affitto sede dicembre"}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Importo stimato (€)</Label>
              <Input inputMode="decimal" value={draft.estimated_amount} onChange={(e) => setDraft({ ...draft, estimated_amount: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Confidenza stima</Label>
              <Select value={draft.confidence} onValueChange={(v) => setDraft({ ...draft, confidence: v as DeadlineDraft["confidence"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">Alta</SelectItem>
                  <SelectItem value="medium">Media</SelectItem>
                  <SelectItem value="low">Bassa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Avviso (giorni prima)</Label>
              <Input
                type="number"
                min={0}
                max={180}
                value={draft.notify_days_before}
                onChange={(e) => setDraft({ ...draft, notify_days_before: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Ricorrenza</Label>
              <Select
                value={draft.recurrence || "none"}
                onValueChange={(v) => setDraft({ ...draft, recurrence: v === "none" ? "" : (v as DeadlineDraft["recurrence"]) })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Una tantum</SelectItem>
                  <SelectItem value="monthly">Mensile</SelectItem>
                  <SelectItem value="quarterly">Trimestrale</SelectItem>
                  <SelectItem value="yearly">Annuale</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Le ricorrenze avanzano la scadenza alla prossima occorrenza quando segni "pagata".
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Stato</Label>
              <Select value={draft.status} onValueChange={(v) => setDraft({ ...draft, status: v as DeadlineDraft["status"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Da pagare</SelectItem>
                  <SelectItem value="paid">Pagata</SelectItem>
                  <SelectItem value="cancelled">Annullata</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                "Scaduta" viene calcolato in automatico.
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Note</Label>
            <Textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} rows={2} />
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
