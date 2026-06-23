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
import { formatEUR, formatDate } from "@/lib/format";

import { markDeadlinePaid } from "@/lib/deadlines.functions";

export type DeadlineForPayment = {
  id: string;
  title: string;
  category: string | null;
  due_date: string;
  estimated_amount: number | null;
  recurrence: "monthly" | "quarterly" | "yearly" | null;
};

function recurrenceLabel(r: string | null): string {
  switch (r) {
    case "monthly": return "Mensile";
    case "quarterly": return "Trimestrale";
    case "yearly": return "Annuale";
    default: return "Una tantum";
  }
}

export function DeadlinePaymentDialog({
  open, onOpenChange, companyId, deadline,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  companyId: string;
  deadline: DeadlineForPayment | null;
}) {
  const queryClient = useQueryClient();
  const record = useServerFn(markDeadlinePaid);

  const [amount, setAmount] = useState<string>("");
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState<string>("bonifico");
  const [createMovement, setCreateMovement] = useState<boolean>(true);
  const [note, setNote] = useState<string>("");

  useEffect(() => {
    if (open && deadline) {
      setAmount(deadline.estimated_amount ? Number(deadline.estimated_amount).toFixed(2) : "");
      setDate(new Date().toISOString().slice(0, 10));
      setMethod("bonifico");
      setCreateMovement(true);
      setNote("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, deadline?.id]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!deadline) throw new Error("Nessuna scadenza");
      const a = Number(amount.replace(",", "."));
      if (!Number.isFinite(a) || a <= 0) throw new Error("Importo non valido");
      await record({
        data: {
          deadline_id: deadline.id,
          company_id: companyId,
          amount: a,
          payment_date: date,
          payment_method: method,
          note: note || null,
          create_movement: createMovement,
        },
      });
    },
    onSuccess: () => {
      toast.success(deadline?.recurrence ? "Pagamento registrato — prossima occorrenza generata" : "Scadenza marcata come pagata");
      queryClient.invalidateQueries({ queryKey: ["deadlines", companyId] });
      queryClient.invalidateQueries({ queryKey: ["transactions", companyId] });
      queryClient.invalidateQueries({ queryKey: ["cashflow-summary", companyId] });
      queryClient.invalidateQueries({ queryKey: ["forecast", companyId] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-kpis", companyId] });
      onOpenChange(false);
    },
    onError: (e) => toast.error("Registrazione fallita", { description: e instanceof Error ? e.message : "" }),
  });

  if (!deadline) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Marca come pagata</DialogTitle>
          <DialogDescription>
            {deadline.title}{deadline.category ? ` · ${deadline.category}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="rounded-md border bg-muted/30 p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Scadenza</span>
              <span className="font-medium">{formatDate(deadline.due_date)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Importo stimato</span>
              <span>{deadline.estimated_amount != null ? formatEUR(Number(deadline.estimated_amount)) : "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Ricorrenza</span>
              <span>{recurrenceLabel(deadline.recurrence)}</span>
            </div>
            {deadline.recurrence && (
              <p className="mt-2 text-[11px] text-muted-foreground">
                Marcando come pagata, la scadenza avanzerà automaticamente alla prossima occorrenza.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Importo effettivo (€)</Label>
              <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Data pagamento</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Metodo</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="bonifico">Bonifico</SelectItem>
                <SelectItem value="addebito">Addebito SEPA</SelectItem>
                <SelectItem value="f24">F24</SelectItem>
                <SelectItem value="carta">Carta</SelectItem>
                <SelectItem value="contanti">Contanti</SelectItem>
                <SelectItem value="altro">Altro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Nota (opzionale)</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Riferimento…" />
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <div className="text-sm font-medium">Genera movimento bancario</div>
              <div className="text-xs text-muted-foreground">Crea automaticamente l'uscita collegata (origin=deadline).</div>
            </div>
            <Switch checked={createMovement} onCheckedChange={setCreateMovement} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Annulla</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Conferma pagamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
