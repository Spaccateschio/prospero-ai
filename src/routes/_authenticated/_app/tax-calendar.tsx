import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Loader2, AlertCircle, Pencil, Trash2, CheckCircle2, Repeat } from "lucide-react";
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
import { listDeadlines, deleteDeadline } from "@/lib/deadlines.functions";
import { DeadlineFormDialog, type DeadlineDraft, type DeadlineKind } from "@/components/deadlines/deadline-form-dialog";
import { DeadlinePaymentDialog, type DeadlineForPayment } from "@/components/deadlines/deadline-payment-dialog";

export const Route = createFileRoute("/_authenticated/_app/tax-calendar")({
  component: DeadlinesPage,
});

type DeadlineRow = {
  id: string;
  kind: DeadlineKind;
  category: string | null;
  title: string;
  description: string | null;
  due_date: string;
  estimated_amount: number | null;
  actual_amount: number | null;
  confidence: "high" | "medium" | "low";
  status: "pending" | "paid" | "overdue" | "cancelled";
  effective_status: "pending" | "paid" | "overdue" | "cancelled";
  notify_days_before: number;
  recurrence: "monthly" | "quarterly" | "yearly" | null;
};

function DeadlinesPage() {
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
          <AlertDescription>Crea o seleziona un'azienda per gestire le scadenze.</AlertDescription>
        </Alert>
      </div>
    );
  }
  return (
    <div className="space-y-6 p-6">
      <header>
        <h1 className="text-xl font-semibold">Scadenze</h1>
        <p className="text-sm text-muted-foreground">
          Scadenze fiscali e altre scadenze di {active.company.name}
        </p>
      </header>

      <Tabs defaultValue="tax" className="w-full">
        <TabsList>
          <TabsTrigger value="tax">Scadenze fiscali</TabsTrigger>
          <TabsTrigger value="other">Altre scadenze</TabsTrigger>
        </TabsList>

        <TabsContent value="tax" className="mt-6">
          <DeadlinesTab companyId={activeId} scope="tax" />
        </TabsContent>
        <TabsContent value="other" className="mt-6">
          <DeadlinesTab companyId={activeId} scope="other" />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function statusBadge(s: DeadlineRow["effective_status"]) {
  switch (s) {
    case "paid":
      return <Badge className="bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-300 border-emerald-500/30">Pagata</Badge>;
    case "overdue":
      return <Badge variant="destructive">Scaduta</Badge>;
    case "pending":
      return <Badge variant="secondary">Da pagare</Badge>;
    case "cancelled":
      return <Badge variant="outline" className="text-muted-foreground">Annullata</Badge>;
    default:
      return <Badge variant="outline">{s}</Badge>;
  }
}

function confidenceBadge(c: DeadlineRow["confidence"]) {
  switch (c) {
    case "high": return <Badge variant="outline" className="border-emerald-500/30 text-emerald-700 dark:text-emerald-300">Alta</Badge>;
    case "medium": return <Badge variant="outline" className="border-amber-500/30 text-amber-700 dark:text-amber-300">Media</Badge>;
    case "low": return <Badge variant="outline" className="border-muted-foreground/30">Bassa</Badge>;
  }
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

function DeadlinesTab({ companyId, scope }: { companyId: string; scope: "tax" | "other" }) {
  const queryClient = useQueryClient();
  const fetchDeadlines = useServerFn(listDeadlines);
  const del = useServerFn(deleteDeadline);

  const [filter, setFilter] = useState<string>("all");
  const [query, setQuery] = useState<string>("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<(Partial<DeadlineDraft> & { id?: string }) | undefined>(undefined);
  const [paying, setPaying] = useState<DeadlineForPayment | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // defaultKind del form: per "tax" è fisso 'tax'; per "other" partiamo da 'payment'.
  const defaultKind: DeadlineKind = scope === "tax" ? "tax" : "payment";

  const { data: deadlines, isLoading } = useQuery({
    queryKey: ["deadlines", companyId, scope],
    queryFn: async () => {
      const rows = await fetchDeadlines({
        data: scope === "tax"
          ? { company_id: companyId, kind: "tax" }
          : { company_id: companyId, kind_not: "tax" },
      });
      return rows as unknown as DeadlineRow[];
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => { await del({ data: { id, company_id: companyId } }); },
    onSuccess: () => {
      toast.success("Scadenza eliminata");
      queryClient.invalidateQueries({ queryKey: ["deadlines", companyId] });
      setDeletingId(null);
    },
    onError: (e) => toast.error("Eliminazione fallita", { description: e instanceof Error ? e.message : "" }),
  });

  const filtered = (deadlines ?? []).filter((r) => {
    if (filter !== "all" && r.effective_status !== filter) return false;
    if (query) {
      const q = query.toLowerCase();
      const hay = `${r.title} ${r.category ?? ""} ${r.description ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const todayStr = new Date().toISOString().slice(0, 10);
  const in30 = new Date(); in30.setDate(in30.getDate() + 30);
  const in30Str = in30.toISOString().slice(0, 10);

  const totals = filtered.reduce(
    (acc, r) => {
      const amt = Number(r.estimated_amount ?? 0);
      acc.count += 1;
      if (r.effective_status === "overdue") { acc.overdueCount += 1; acc.overdueAmt += amt; }
      else if (r.effective_status === "pending") {
        acc.pendingAmt += amt;
        if (r.due_date >= todayStr && r.due_date <= in30Str) { acc.soonCount += 1; acc.soonAmt += amt; }
      }
      return acc;
    },
    { count: 0, pendingAmt: 0, soonCount: 0, soonAmt: 0, overdueCount: 0, overdueAmt: 0 },
  );

  const scopeLabel = scope === "tax" ? "fiscali" : "non fiscali";
  const categoryHead = scope === "tax" ? "Tipo" : "Categoria";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiMini label="Totale" value={String(totals.count)} />
        <KpiMini label="Da pagare" value={formatEUR(totals.pendingAmt)} tone="warning" />
        <KpiMini label="Entro 30gg" value={`${totals.soonCount} · ${formatEUR(totals.soonAmt)}`} tone="warning" />
        <KpiMini label="Scadute" value={`${totals.overdueCount} · ${formatEUR(totals.overdueAmt)}`} tone="danger" />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Elenco scadenze {scopeLabel}</CardTitle>
            <CardDescription>
              Le scadenze ricorrenti avanzano automaticamente alla prossima occorrenza quando segni "pagata".
            </CardDescription>
          </div>
          <Button onClick={() => { setEditing(undefined); setFormOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" /> Nuova scadenza
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              placeholder="Cerca per titolo, categoria o note"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="max-w-xs"
            />
            <div className="flex flex-wrap gap-1">
              {(["all", "pending", "overdue", "paid", "cancelled"] as const).map((s) => (
                <Button key={s} size="sm" variant={filter === s ? "default" : "outline"} onClick={() => setFilter(s)}>
                  {s === "all" ? "Tutte"
                    : s === "pending" ? "Da pagare"
                    : s === "overdue" ? "Scadute"
                    : s === "paid" ? "Pagate"
                    : "Annullate"}
                </Button>
              ))}
            </div>
          </div>

          {isLoading ? (
            <div className="flex h-40 items-center justify-center text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /></div>
          ) : filtered.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
              <p>Nessuna scadenza {scopeLabel}.</p>
              <Button size="sm" onClick={() => { setEditing(undefined); setFormOpen(true); }}>
                <Plus className="mr-2 h-4 w-4" /> Aggiungi la prima
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{categoryHead}</TableHead>
                    <TableHead>Titolo</TableHead>
                    <TableHead>Scadenza</TableHead>
                    <TableHead className="text-right">Importo stimato</TableHead>
                    <TableHead>Confidenza</TableHead>
                    <TableHead>Ricorrenza</TableHead>
                    <TableHead>Stato</TableHead>
                    <TableHead className="w-[120px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => {
                    const canPay = r.effective_status === "pending" || r.effective_status === "overdue";
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="text-xs">{r.category ?? "—"}</TableCell>
                        <TableCell className="font-medium">{r.title}</TableCell>
                        <TableCell>{formatDate(r.due_date)}</TableCell>
                        <TableCell className="text-right">
                          {r.estimated_amount != null ? formatEUR(Number(r.estimated_amount)) : "—"}
                        </TableCell>
                        <TableCell>{confidenceBadge(r.confidence)}</TableCell>
                        <TableCell>
                          {r.recurrence ? (
                            <span className="inline-flex items-center gap-1 text-xs">
                              <Repeat className="h-3 w-3" />
                              {r.recurrence === "monthly" ? "Mensile" : r.recurrence === "quarterly" ? "Trimestrale" : "Annuale"}
                            </span>
                          ) : <span className="text-xs text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell>{statusBadge(r.effective_status)}</TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            {canPay && (
                              <Button
                                size="icon"
                                variant="ghost"
                                title="Marca come pagata"
                                onClick={() => setPaying({
                                  id: r.id,
                                  title: r.title,
                                  category: r.category,
                                  due_date: r.due_date,
                                  estimated_amount: r.estimated_amount,
                                  recurrence: r.recurrence,
                                })}
                              >
                                <CheckCircle2 className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              size="icon"
                              variant="ghost"
                              title="Modifica"
                              onClick={() => {
                                setEditing({
                                  id: r.id,
                                  kind: r.kind,
                                  category: r.category ?? "",
                                  title: r.title,
                                  description: r.description ?? "",
                                  due_date: r.due_date,
                                  estimated_amount: r.estimated_amount != null ? String(r.estimated_amount) : "",
                                  confidence: r.confidence,
                                  status: (r.status === "overdue" ? "pending" : r.status) as DeadlineDraft["status"],
                                  notify_days_before: String(r.notify_days_before),
                                  recurrence: (r.recurrence ?? "") as DeadlineDraft["recurrence"],
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

      <DeadlineFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        companyId={companyId}
        defaultKind={defaultKind}
        initial={editing}
      />

      <DeadlinePaymentDialog
        open={!!paying}
        onOpenChange={(v) => { if (!v) setPaying(null); }}
        companyId={companyId}
        deadline={paying}
      />

      <AlertDialog open={!!deletingId} onOpenChange={(v) => { if (!v) setDeletingId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare la scadenza?</AlertDialogTitle>
            <AlertDialogDescription>
              L'azione è irreversibile. I movimenti già registrati collegati a questa scadenza NON verranno eliminati.
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
