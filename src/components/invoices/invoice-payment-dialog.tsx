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
import { formatEUR } from "@/lib/format";

import { recordInvoicePayment } from "@/lib/invoices.functions";

export type InvoiceForPayment = {
  id: string;
  number: string | null;
  counterpart_name: string;
  total_amount: number;
  paid_amount: number;
  direction: "attiva" | "passiva";
  payment_method?: string | null;
};

export function InvoicePaymentDialog({
  open, onOpenChange, companyId, invoice,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  companyId: string;
  invoice: InvoiceForPayment | null;
}) {
  const queryClient = useQueryClient();
  const record = useServerFn(recordInvoicePayment);

  const remaining = invoice ? Math.max(0, invoice.total_amount - invoice.paid_amount) : 0;
  const [amount, setAmount] = useState<string>("");
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState<string>("bonifico");
  const [createMovement, setCreateMovement] = useState<boolean>(true);
  const [note, setNote] = useState<string>("");

  useEffect(() => {
    if (open && invoice) {
      setAmount(remaining > 0 ? remaining.toFixed(2) : "");
      setDate(new Date().toISOString().slice(0, 10));
      setMethod(invoice.payment_method ?? "bonifico");
      setCreateMovement(true);
      setNote("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, invoice?.id]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!invoice) throw new Error("Nessuna fattura");
      const a = Number(amount.replace(",", "."));
      if (!Number.isFinite(a) || a <= 0) throw new Error("Importo non valido");
      if (a > remaining + 0.01) throw new Error(`Massimo registrabile: ${formatEUR(remaining)}`);
      await record({
        data: {
          invoice_id: invoice.id,
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
      toast.success("Pagamento registrato");
      queryClient.invalidateQueries({ queryKey: ["invoices", companyId] });
      queryClient.invalidateQueries({ queryKey: ["transactions", companyId] });
      queryClient.invalidateQueries({ queryKey: ["cashflow-summary", companyId] });
      queryClient.invalidateQueries({ queryKey: ["forecast", companyId] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-kpis", companyId] });
      onOpenChange(false);
    },
    onError: (e) => toast.error("Registrazione fallita", { description: e instanceof Error ? e.message : "" }),
  });

  if (!invoice) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registra pagamento</DialogTitle>
          <DialogDescription>
            Fattura {invoice.number ?? "—"} · {invoice.counterpart_name}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="rounded-md border bg-muted/30 p-3 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Totale fattura</span><span className="font-medium">{formatEUR(invoice.total_amount)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Già pagato</span><span>{formatEUR(invoice.paid_amount)}</span></div>
            <div className="flex justify-between font-medium"><span>Residuo</span><span>{formatEUR(remaining)}</span></div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Importo (€)</Label>
              <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Data</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Metodo</Label>
            <Select value={method} onValueChange={setMethod}>
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

          <div className="space-y-1.5">
            <Label>Nota (opzionale)</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Riferimento, descrizione…" />
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <div className="text-sm font-medium">Genera movimento bancario</div>
              <div className="text-xs text-muted-foreground">
                Crea automaticamente un'{invoice.direction === "attiva" ? "entrata" : "uscita"} collegata a questa fattura.
              </div>
            </div>
            <Switch checked={createMovement} onCheckedChange={setCreateMovement} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Annulla</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Registra
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
