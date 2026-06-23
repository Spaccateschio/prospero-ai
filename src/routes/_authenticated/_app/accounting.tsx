import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Loader2, AlertCircle, Pencil, Trash2, Wallet, Repeat } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

import { useActiveCompany } from "@/hooks/use-companies";
import { formatEUR, formatDate } from "@/lib/format";
import { listInvoices, deleteInvoice } from "@/lib/invoices.functions";
import { listTransactions, deleteTransaction, listCategories } from "@/lib/cashflow.functions";
import { InvoiceFormDialog, type InvoiceDraft } from "@/components/invoices/invoice-form-dialog";
import { InvoicePaymentDialog, type InvoiceForPayment } from "@/components/invoices/invoice-payment-dialog";
import { TransactionFormDialog, type TransactionDraft } from "@/components/cashflow/transaction-form-dialog";

export const Route = createFileRoute("/_authenticated/_app/accounting")({
  component: AccountingPage,
});

function AccountingPage() {
  const { activeId, active, isLoading } = useActiveCompany();
  if (isLoading) {
    return <div className="flex items-center justify-center p-12 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /></div>;
  }
  if (!activeId || !active) {
    return (
      <div className="p-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Nessuna azienda selezionata</AlertTitle>
          <AlertDescription>Crea o seleziona un'azienda per gestire la contabilità.</AlertDescription>
        </Alert>
      </div>
    );
  }
  return (
    <div className="space-y-6 p-6">
      <header>
        <h1 className="text-xl font-semibold">Contabilità</h1>
        <p className="text-sm text-muted-foreground">Fatture attive, passive e costi fissi di {active.company.name}</p>
      </header>

      <Tabs defaultValue="attive" className="w-full">
        <TabsList>
          <TabsTrigger value="attive">Fatture attive</TabsTrigger>
          <TabsTrigger value="passive">Fatture passive</TabsTrigger>
          <TabsTrigger value="fissi">Costi fissi</TabsTrigger>
        </TabsList>

        <TabsContent value="attive" className="mt-6"><InvoicesTab companyId={activeId} direction="attiva" /></TabsContent>
        <TabsContent value="passive" className="mt-6"><InvoicesTab companyId={activeId} direction="passiva" /></TabsContent>
        <TabsContent value="fissi" className="mt-6"><FixedCostsTab companyId={activeId} /></TabsContent>
      </Tabs>
    </div>
  );
}

// ===================== INVOICES TAB =====================

type InvoiceRow = {
  id: string;
  direction: "attiva" | "passiva";
  number: string | null;
  counterpart_name: string;
  counterpart_vat: string | null;
  amount: number;
  vat_amount: number | null;
  total_amount: number;
  paid_amount: number;
  issue_date: string | null;
  due_date: string | null;
  status: "draft" | "sent" | "partially_paid" | "paid" | "overdue" | "cancelled";
  effective_status: "draft" | "sent" | "partially_paid" | "paid" | "overdue" | "cancelled";
  payment_method: string | null;
  notes: string | null;
};

function statusBadge(s: InvoiceRow["effective_status"]) {
  switch (s) {
    case "paid":
      return <Badge className="bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-300 border-emerald-500/30">Pagata</Badge>;
    case "partially_paid":
      return <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 hover:bg-amber-500/15 border-amber-500/30">Parziale</Badge>;
    case "overdue":
      return <Badge variant="destructive">Scaduta</Badge>;
    case "sent":
      return <Badge variant="secondary">Da pagare</Badge>;
    case "draft":
      return <Badge variant="outline">Bozza</Badge>;
    case "cancelled":
      return <Badge variant="outline" className="text-muted-foreground">Annullata</Badge>;
    default:
      return <Badge variant="outline">{s}</Badge>;
  }
}

function InvoicesTab({ companyId, direction }: { companyId: string; direction: "attiva" | "passiva" }) {
  const queryClient = useQueryClient();
  const fetchInvoices = useServerFn(listInvoices);
  const del = useServerFn(deleteInvoice);

  const [filter, setFilter] = useState<string>("all");
  const [query, setQuery] = useState<string>("");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<(Partial<InvoiceDraft> & { id?: string }) | undefined>(undefined);

  const [payingInvoice, setPayingInvoice] = useState<InvoiceForPayment | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: invoices, isLoading } = useQuery({
    queryKey: ["invoices", companyId, direction],
    queryFn: async () => {
      const rows = await fetchInvoices({ data: { company_id: companyId, direction } });
      return rows as unknown as InvoiceRow[];
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      await del({ data: { id, company_id: companyId } });
    },
    onSuccess: () => {
      toast.success("Fattura eliminata");
      queryClient.invalidateQueries({ queryKey: ["invoices", companyId] });
      setDeletingId(null);
    },
    onError: (e) => toast.error("Eliminazione fallita", { description: e instanceof Error ? e.message : "" }),
  });

  const filtered = (invoices ?? []).filter((r) => {
    if (filter !== "all" && r.effective_status !== filter) return false;
    if (query) {
      const q = query.toLowerCase();
      const hay = `${r.number ?? ""} ${r.counterpart_name} ${r.counterpart_vat ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const totals = filtered.reduce(
    (acc, r) => {
      acc.total += Number(r.total_amount);
      acc.paid += Number(r.paid_amount);
      const open = Math.max(0, Number(r.total_amount) - Number(r.paid_amount));
      if (r.effective_status === "overdue") acc.overdue += open;
      else if (r.effective_status === "sent" || r.effective_status === "partially_paid") acc.open += open;
      return acc;
    },
    { total: 0, paid: 0, open: 0, overdue: 0 },
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiMini label="Totale" value={formatEUR(totals.total)} />
        <KpiMini label="Incassato/Pagato" value={formatEUR(totals.paid)} tone="success" />
        <KpiMini label="Aperto" value={formatEUR(totals.open)} tone="warning" />
        <KpiMini label="Scaduto" value={formatEUR(totals.overdue)} tone="danger" />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Elenco fatture {direction === "attiva" ? "attive" : "passive"}</CardTitle>
            <CardDescription>
              Filtra per stato, registra pagamenti (anche parziali), elimina o modifica.
            </CardDescription>
          </div>
          <Button onClick={() => { setEditing(undefined); setFormOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" /> Nuova fattura
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              placeholder="Cerca per numero, controparte o P.IVA"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="max-w-xs"
            />
            <div className="flex flex-wrap gap-1">
              {(["all", "sent", "partially_paid", "overdue", "paid", "draft", "cancelled"] as const).map((s) => (
                <Button
                  key={s}
                  size="sm"
                  variant={filter === s ? "default" : "outline"}
                  onClick={() => setFilter(s)}
                >
                  {s === "all" ? "Tutte"
                    : s === "sent" ? "Da pagare"
                    : s === "partially_paid" ? "Parziali"
                    : s === "overdue" ? "Scadute"
                    : s === "paid" ? "Pagate"
                    : s === "draft" ? "Bozze"
                    : "Annullate"}
                </Button>
              ))}
            </div>
          </div>

          {isLoading ? (
            <div className="flex h-40 items-center justify-center text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /></div>
          ) : filtered.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
              <p>Nessuna fattura {direction === "attiva" ? "attiva" : "passiva"}.</p>
              <Button size="sm" onClick={() => { setEditing(undefined); setFormOpen(true); }}>
                <Plus className="mr-2 h-4 w-4" /> Aggiungi la prima
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Numero</TableHead>
                    <TableHead>{direction === "attiva" ? "Cliente" : "Fornitore"}</TableHead>
                    <TableHead>Emissione</TableHead>
                    <TableHead>Scadenza</TableHead>
                    <TableHead className="text-right">Totale</TableHead>
                    <TableHead className="text-right">Residuo</TableHead>
                    <TableHead>Stato</TableHead>
                    <TableHead className="w-[120px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => {
                    const residual = Math.max(0, Number(r.total_amount) - Number(r.paid_amount));
                    const canPay = r.effective_status !== "paid" && r.effective_status !== "cancelled" && r.effective_status !== "draft";
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="font-mono text-xs">{r.number ?? "—"}</TableCell>
                        <TableCell className="font-medium">{r.counterpart_name}</TableCell>
                        <TableCell>{formatDate(r.issue_date)}</TableCell>
                        <TableCell>{formatDate(r.due_date)}</TableCell>
                        <TableCell className="text-right">{formatEUR(Number(r.total_amount))}</TableCell>
                        <TableCell className="text-right">{formatEUR(residual)}</TableCell>
                        <TableCell>{statusBadge(r.effective_status)}</TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            {canPay && (
                              <Button
                                size="icon"
                                variant="ghost"
                                title="Registra pagamento"
                                onClick={() => setPayingInvoice({
                                  id: r.id,
                                  number: r.number,
                                  counterpart_name: r.counterpart_name,
                                  total_amount: Number(r.total_amount),
                                  paid_amount: Number(r.paid_amount),
                                  direction: r.direction,
                                  payment_method: r.payment_method,
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
                                  id: r.id,
                                  direction: r.direction,
                                  number: r.number ?? "",
                                  counterpart_name: r.counterpart_name,
                                  counterpart_vat: r.counterpart_vat ?? "",
                                  amount: String(r.amount ?? ""),
                                  vat_amount: r.vat_amount != null ? String(r.vat_amount) : "",
                                  total_amount: String(r.total_amount ?? ""),
                                  issue_date: r.issue_date ?? "",
                                  due_date: r.due_date ?? "",
                                  status: (r.status === "overdue" ? "sent" : r.status) as InvoiceDraft["status"],
                                  payment_method: r.payment_method ?? "bonifico",
                                  notes: r.notes ?? "",
                                });
                                setFormOpen(true);
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              title="Elimina"
                              onClick={() => setDeletingId(r.id)}
                            >
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

      <InvoiceFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        companyId={companyId}
        direction={direction}
        initial={editing}
      />

      <InvoicePaymentDialog
        open={!!payingInvoice}
        onOpenChange={(v) => { if (!v) setPayingInvoice(null); }}
        companyId={companyId}
        invoice={payingInvoice}
      />

      <AlertDialog open={!!deletingId} onOpenChange={(v) => { if (!v) setDeletingId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare la fattura?</AlertDialogTitle>
            <AlertDialogDescription>
              L'azione è irreversibile. I movimenti già registrati collegati a questa fattura NON verranno eliminati.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (deletingId) deleteMut.mutate(deletingId); }}
            >
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function KpiMini({ label, value, tone }: { label: string; value: string; tone?: "success" | "warning" | "danger" }) {
  const color =
    tone === "success" ? "text-emerald-600 dark:text-emerald-400"
    : tone === "warning" ? "text-amber-600 dark:text-amber-400"
    : tone === "danger" ? "text-destructive"
    : "text-foreground";
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className={`mt-1 text-xl font-semibold ${color}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

// ===================== FIXED COSTS TAB =====================
// Vista filtrata su transazioni uscita con recurrence != null.
// Riusa TransactionFormDialog per coerenza con Cash Flow.

type TxRow = {
  id: string;
  type: "entrata" | "uscita";
  amount: number;
  date: string;
  description: string | null;
  category: string | null;
  counterpart: string | null;
  payment_method: string | null;
  recurrence: "monthly" | "quarterly" | "yearly" | null;
  is_forecast: boolean;
};

function recurrenceLabel(r: string | null): string {
  switch (r) {
    case "monthly": return "Mensile";
    case "quarterly": return "Trimestrale";
    case "yearly": return "Annuale";
    default: return "—";
  }
}

function FixedCostsTab({ companyId }: { companyId: string }) {
  const queryClient = useQueryClient();
  const fetchTx = useServerFn(listTransactions);
  const fetchCats = useServerFn(listCategories);
  const del = useServerFn(deleteTransaction);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<(Partial<TransactionDraft> & { id?: string }) | undefined>(undefined);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: txs, isLoading } = useQuery({
    queryKey: ["transactions", companyId, "fixed-costs"],
    queryFn: async () => {
      const rows = await fetchTx({ data: { company_id: companyId } });
      return (rows as unknown as TxRow[]).filter((r) => r.type === "uscita" && r.recurrence !== null);
    },
  });

  const { data: cats } = useQuery({
    queryKey: ["categories", companyId],
    queryFn: () => fetchCats({ data: { company_id: companyId } }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      await del({ data: { id, company_id: companyId } });
    },
    onSuccess: () => {
      toast.success("Costo fisso eliminato");
      queryClient.invalidateQueries({ queryKey: ["transactions", companyId] });
      queryClient.invalidateQueries({ queryKey: ["cashflow-summary", companyId] });
      queryClient.invalidateQueries({ queryKey: ["forecast", companyId] });
      setDeletingId(null);
    },
    onError: (e) => toast.error("Eliminazione fallita", { description: e instanceof Error ? e.message : "" }),
  });

  const monthlyEquivalent = (txs ?? []).reduce((acc, r) => {
    const a = Number(r.amount);
    const m = r.recurrence === "monthly" ? a : r.recurrence === "quarterly" ? a / 3 : a / 12;
    return acc + m;
  }, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <KpiMini label="Costi fissi attivi" value={String((txs ?? []).length)} />
        <KpiMini label="Impatto mensile equivalente" value={formatEUR(monthlyEquivalent)} tone="warning" />
        <KpiMini label="Impatto annuo equivalente" value={formatEUR(monthlyEquivalent * 12)} />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Costi fissi ricorrenti</CardTitle>
            <CardDescription>
              Uscite ricorrenti (affitti, abbonamenti, utenze). Vengono proiettate automaticamente nel previsionale.
            </CardDescription>
          </div>
          <Button onClick={() => {
            setEditing({ type: "uscita", is_forecast: false, recurrence: "monthly" });
            setFormOpen(true);
          }}>
            <Plus className="mr-2 h-4 w-4" /> Nuovo costo fisso
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex h-40 items-center justify-center text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /></div>
          ) : (txs ?? []).length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
              <Repeat className="h-6 w-6 opacity-50" />
              <p>Nessun costo fisso registrato.</p>
              <Button size="sm" onClick={() => {
                setEditing({ type: "uscita", is_forecast: false, recurrence: "monthly" });
                setFormOpen(true);
              }}>
                <Plus className="mr-2 h-4 w-4" /> Aggiungi il primo
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Descrizione</TableHead>
                    <TableHead>Controparte</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Frequenza</TableHead>
                    <TableHead>Dal</TableHead>
                    <TableHead className="text-right">Importo</TableHead>
                    <TableHead className="w-[100px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(txs ?? []).map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.description ?? "—"}</TableCell>
                      <TableCell>{r.counterpart ?? "—"}</TableCell>
                      <TableCell>{r.category ?? "—"}</TableCell>
                      <TableCell><Badge variant="secondary">{recurrenceLabel(r.recurrence)}</Badge></TableCell>
                      <TableCell>{formatDate(r.date)}</TableCell>
                      <TableCell className="text-right">{formatEUR(Number(r.amount))}</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              setEditing({
                                id: r.id,
                                type: "uscita",
                                amount: String(r.amount),
                                date: r.date,
                                description: r.description ?? "",
                                category: r.category ?? "",
                                counterpart: r.counterpart ?? "",
                                payment_method: r.payment_method ?? "bonifico",
                                is_forecast: false,
                                recurrence: r.recurrence ?? "monthly",
                              });
                              setFormOpen(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => setDeletingId(r.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <TransactionFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        companyId={companyId}
        initial={editing}
        categories={(cats ?? []) as { name: string; type: string }[]}
      />

      <AlertDialog open={!!deletingId} onOpenChange={(v) => { if (!v) setDeletingId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare il costo fisso?</AlertDialogTitle>
            <AlertDialogDescription>
              Verrà rimosso anche dalle proiezioni di cash flow.
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
