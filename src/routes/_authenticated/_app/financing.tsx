import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Loader2, AlertCircle, Pencil, Trash2, Wallet, Landmark } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

import { useActiveCompany } from "@/hooks/use-companies";
import { formatEUR, formatDate } from "@/lib/format";
import { listLoans, deleteLoan } from "@/lib/loans.functions";
import { LoanFormDialog, type LoanDraft } from "@/components/loans/loan-form-dialog";
import { LoanInstallmentDialog, type LoanForInstallment } from "@/components/loans/loan-installment-dialog";

export const Route = createFileRoute("/_authenticated/_app/financing")({
  component: FinancingPage,
});

type LoanRow = {
  id: string;
  name: string;
  lender: string | null;
  initial_amount: number;
  residual: number;
  rate_type: "fisso" | "variabile" | "misto";
  rate_value: number | null;
  installment: number | null;
  total_installments: number | null;
  paid_installments: number | null;
  frequency: "monthly" | "quarterly" | "yearly";
  start_date: string | null;
  end_date: string | null;
  next_due_date: string | null;
  status: "active" | "paid_off" | "defaulted";
  notes: string | null;
};

function frequencyLabel(f: string): string {
  return f === "monthly" ? "Mensile" : f === "quarterly" ? "Trimestrale" : "Annuale";
}

function statusBadge(s: LoanRow["status"]) {
  if (s === "paid_off") return <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/15 border-emerald-500/30">Estinto</Badge>;
  if (s === "defaulted") return <Badge variant="destructive">In default</Badge>;
  return <Badge variant="secondary">Attivo</Badge>;
}

function FinancingPage() {
  const queryClient = useQueryClient();
  const { activeId, active, isLoading } = useActiveCompany();
  const fetchLoans = useServerFn(listLoans);
  const del = useServerFn(deleteLoan);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<(Partial<LoanDraft> & { id?: string }) | undefined>(undefined);
  const [payingLoan, setPayingLoan] = useState<LoanForInstallment | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: loans, isLoading: loading } = useQuery({
    queryKey: ["loans", activeId],
    queryFn: async () => {
      if (!activeId) return [] as LoanRow[];
      const rows = await fetchLoans({ data: { company_id: activeId } });
      return rows as unknown as LoanRow[];
    },
    enabled: !!activeId,
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      if (!activeId) return;
      await del({ data: { id, company_id: activeId } });
    },
    onSuccess: () => {
      toast.success("Finanziamento eliminato");
      queryClient.invalidateQueries({ queryKey: ["loans", activeId] });
      queryClient.invalidateQueries({ queryKey: ["forecast", activeId] });
      setDeletingId(null);
    },
    onError: (e) => toast.error("Eliminazione fallita", { description: e instanceof Error ? e.message : "" }),
  });

  if (isLoading) {
    return <div className="flex items-center justify-center p-12 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /></div>;
  }
  if (!activeId || !active) {
    return (
      <div className="p-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Nessuna azienda selezionata</AlertTitle>
          <AlertDescription>Crea o seleziona un'azienda per gestire i finanziamenti.</AlertDescription>
        </Alert>
      </div>
    );
  }

  const all = loans ?? [];
  const active_loans = all.filter((l) => l.status === "active");
  const totalResidual = active_loans.reduce((s, l) => s + Number(l.residual), 0);
  const totalMonthlyEq = active_loans.reduce((s, l) => {
    const inst = Number(l.installment ?? 0);
    if (l.frequency === "monthly") return s + inst;
    if (l.frequency === "quarterly") return s + inst / 3;
    return s + inst / 12;
  }, 0);

  return (
    <div className="space-y-6 p-6">
      <header>
        <h1 className="text-xl font-semibold">Finanziamenti</h1>
        <p className="text-sm text-muted-foreground">Mutui, leasing e prestiti di {active.company.name}</p>
      </header>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <KpiMini label="Finanziamenti attivi" value={String(active_loans.length)} />
        <KpiMini label="Debito residuo totale" value={formatEUR(totalResidual)} tone="warning" />
        <KpiMini label="Impatto mensile equivalente" value={formatEUR(totalMonthlyEq)} />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Elenco finanziamenti</CardTitle>
            <CardDescription>
              Registra le rate pagate per tenere allineato residuo e cash flow. Le rate future vengono proiettate automaticamente nel previsionale.
            </CardDescription>
          </div>
          <Button onClick={() => { setEditing(undefined); setFormOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" /> Nuovo finanziamento
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex h-40 items-center justify-center text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /></div>
          ) : all.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
              <Landmark className="h-6 w-6 opacity-50" />
              <p>Nessun finanziamento registrato.</p>
              <Button size="sm" onClick={() => { setEditing(undefined); setFormOpen(true); }}>
                <Plus className="mr-2 h-4 w-4" /> Aggiungi il primo
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Ente</TableHead>
                    <TableHead>Frequenza</TableHead>
                    <TableHead>Avanzamento</TableHead>
                    <TableHead className="text-right">Rata</TableHead>
                    <TableHead className="text-right">Residuo</TableHead>
                    <TableHead>Prossima scadenza</TableHead>
                    <TableHead>Stato</TableHead>
                    <TableHead className="w-[120px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {all.map((l) => {
                    const paid = Number(l.paid_installments ?? 0);
                    const total = Number(l.total_installments ?? 0);
                    const pct = total > 0 ? Math.round((paid / total) * 100) : 0;
                    const canPay = l.status === "active";
                    return (
                      <TableRow key={l.id}>
                        <TableCell className="font-medium">{l.name}</TableCell>
                        <TableCell>{l.lender ?? "—"}</TableCell>
                        <TableCell>{frequencyLabel(l.frequency)}</TableCell>
                        <TableCell className="min-w-[140px]">
                          <div className="flex flex-col gap-1">
                            <div className="text-xs text-muted-foreground">{paid} / {total} rate · {pct}%</div>
                            <Progress value={pct} className="h-1.5" />
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{formatEUR(Number(l.installment ?? 0))}</TableCell>
                        <TableCell className="text-right">{formatEUR(Number(l.residual))}</TableCell>
                        <TableCell>{formatDate(l.next_due_date)}</TableCell>
                        <TableCell>{statusBadge(l.status)}</TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            {canPay && (
                              <Button
                                size="icon"
                                variant="ghost"
                                title="Registra rata"
                                onClick={() => setPayingLoan({
                                  id: l.id,
                                  name: l.name,
                                  lender: l.lender,
                                  installment: Number(l.installment ?? 0),
                                  paid_installments: paid,
                                  total_installments: total,
                                  residual: Number(l.residual),
                                })}
                              >
                                <Wallet className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              size="icon"
                              variant="ghost"
                              title="Modifica"
                              onClick={() => {
                                setEditing({
                                  id: l.id,
                                  name: l.name,
                                  lender: l.lender ?? "",
                                  initial_amount: String(l.initial_amount ?? ""),
                                  rate_type: l.rate_type,
                                  rate_value: l.rate_value != null ? String(l.rate_value) : "",
                                  installment: String(l.installment ?? ""),
                                  total_installments: String(l.total_installments ?? ""),
                                  frequency: l.frequency,
                                  start_date: l.start_date ?? "",
                                  next_due_date: l.next_due_date ?? "",
                                  notes: l.notes ?? "",
                                });
                                setFormOpen(true);
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" title="Elimina" onClick={() => setDeletingId(l.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <LoanFormDialog open={formOpen} onOpenChange={setFormOpen} companyId={activeId} initial={editing} />
      <LoanInstallmentDialog
        open={!!payingLoan}
        onOpenChange={(v) => { if (!v) setPayingLoan(null); }}
        companyId={activeId}
        loan={payingLoan}
      />

      <AlertDialog open={!!deletingId} onOpenChange={(v) => { if (!v) setDeletingId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare il finanziamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Lo storico dei movimenti collegati alle rate NON verrà eliminato.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (deletingId) deleteMut.mutate(deletingId); }}>
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function KpiMini({ label, value, tone }: { label: string; value: string; tone?: "warning" }) {
  const color = tone === "warning" ? "text-amber-600 dark:text-amber-400" : "text-foreground";
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className={`mt-1 text-xl font-semibold ${color}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
