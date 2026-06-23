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

import { recordLoanInstallment } from "@/lib/loans.functions";

export type LoanForInstallment = {
  id: string;
  name: string;
  lender: string | null;
  installment: number;
  paid_installments: number;
  total_installments: number;
  residual: number;
};

export function LoanInstallmentDialog({
  open, onOpenChange, companyId, loan,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  companyId: string;
  loan: LoanForInstallment | null;
}) {
  const queryClient = useQueryClient();
  const record = useServerFn(recordLoanInstallment);

  const [amount, setAmount] = useState<string>("");
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState<string>("addebito");
  const [createMovement, setCreateMovement] = useState<boolean>(true);
  const [note, setNote] = useState<string>("");

  useEffect(() => {
    if (open && loan) {
      setAmount(loan.installment ? loan.installment.toFixed(2) : "");
      setDate(new Date().toISOString().slice(0, 10));
      setMethod("addebito");
      setCreateMovement(true);
      setNote("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, loan?.id]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!loan) throw new Error("Nessun finanziamento");
      const a = Number(amount.replace(",", "."));
      if (!Number.isFinite(a) || a <= 0) throw new Error("Importo non valido");
      await record({
        data: {
          loan_id: loan.id,
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
      toast.success("Rata registrata");
      queryClient.invalidateQueries({ queryKey: ["loans", companyId] });
      queryClient.invalidateQueries({ queryKey: ["transactions", companyId] });
      queryClient.invalidateQueries({ queryKey: ["cashflow-summary", companyId] });
      queryClient.invalidateQueries({ queryKey: ["forecast", companyId] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-kpis", companyId] });
      onOpenChange(false);
    },
    onError: (e) => toast.error("Registrazione fallita", { description: e instanceof Error ? e.message : "" }),
  });

  if (!loan) return null;
  const nextNumber = loan.paid_installments + 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registra rata</DialogTitle>
          <DialogDescription>
            {loan.name}{loan.lender ? ` · ${loan.lender}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="rounded-md border bg-muted/30 p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Rata corrente</span>
              <span className="font-medium">{nextNumber} di {loan.total_installments}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Residuo attuale</span>
              <span>{formatEUR(loan.residual)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Rata teorica</span>
              <span>{formatEUR(loan.installment)}</span>
            </div>
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
                <SelectItem value="addebito">Addebito SEPA</SelectItem>
                <SelectItem value="bonifico">Bonifico</SelectItem>
                <SelectItem value="ri.ba">Ri.Ba.</SelectItem>
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
              <div className="text-xs text-muted-foreground">Crea automaticamente l'uscita collegata a questa rata.</div>
            </div>
            <Switch checked={createMovement} onCheckedChange={setCreateMovement} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Annulla</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Registra rata
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
