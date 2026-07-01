import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

import { upsertFinancialResource, type FinancialResourceRow } from "@/lib/resources.functions";

const KIND_LABELS: Record<string, string> = {
  banca: "Banca",
  cassa_contanti: "Cassa Contanti",
  cassa_assegni: "Cassa Assegni",
  altro: "Altro",
};

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  companyId: string;
  resource?: FinancialResourceRow | null;
};

export function ResourceFormDialog({ open, onOpenChange, companyId, resource }: Props) {
  const queryClient = useQueryClient();
  const upsert = useServerFn(upsertFinancialResource);

  const [name, setName] = useState("");
  const [kind, setKind] = useState<"banca" | "cassa_contanti" | "cassa_assegni" | "altro">("banca");
  const [openingBalance, setOpeningBalance] = useState("0");
  const [openingDate, setOpeningDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (open) {
      setName(resource?.name ?? "");
      setKind(resource?.kind ?? "banca");
      setOpeningBalance(resource ? String(resource.opening_balance) : "0");
      setOpeningDate(resource?.opening_balance_date ?? new Date().toISOString().slice(0, 10));
      setNotes(resource?.notes ?? "");
    }
  }, [open, resource]);

  const mutation = useMutation({
    mutationFn: () =>
      upsert({
        data: {
          id: resource?.id,
          company_id: companyId,
          name: name.trim(),
          kind,
          opening_balance: Number(openingBalance.replace(",", ".")) || 0,
          opening_balance_date: openingDate,
          notes: notes.trim() || null,
        },
      }),
    onSuccess: () => {
      toast.success(resource ? "Risorsa aggiornata" : "Risorsa creata");
      queryClient.invalidateQueries({ queryKey: ["financial_resources", companyId] });
      onOpenChange(false);
    },
    onError: (e) => {
      toast.error("Errore salvataggio", { description: e instanceof Error ? e.message : "" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{resource ? "Modifica risorsa" : "Nuova risorsa finanziaria"}</DialogTitle>
          <DialogDescription>
            Es. Banca 1, Banca 2, Cassa Assegni, Cassa Contanti. Imposta il saldo iniziale per allineare i conti.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="res-name">Nome</Label>
            <Input id="res-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Banca 1" />
          </div>

          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as typeof kind)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(KIND_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="res-balance">Saldo iniziale (€)</Label>
              <Input
                id="res-balance"
                inputMode="decimal"
                value={openingBalance}
                onChange={(e) => setOpeningBalance(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="res-date">Data saldo iniziale</Label>
              <Input
                id="res-date"
                type="date"
                value={openingDate}
                onChange={(e) => setOpeningDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="res-notes">Note (opzionale)</Label>
            <Textarea id="res-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annulla</Button>
          <Button
            disabled={!name.trim() || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {resource ? "Salva modifiche" : "Crea risorsa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
