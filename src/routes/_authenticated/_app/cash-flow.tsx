import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Plus, Loader2, Trash2, Pencil, AlertCircle, ArrowDown, ArrowUp, Repeat, Clock,
} from "lucide-react";
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine,
} from "recharts";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

import { useActiveCompany } from "@/hooks/use-companies";
import { formatEUR, formatEURCompact, formatDate } from "@/lib/format";
import { TransactionFormDialog, type TransactionDraft } from "@/components/cashflow/transaction-form-dialog";
import {
  listTransactions, deleteTransaction, getForecast,
  listCategories, upsertCategory, deleteCategory,
} from "@/lib/cashflow.functions";

export const Route = createFileRoute("/_authenticated/_app/cash-flow")({
  component: CashFlowPage,
});

function CashFlowPage() {
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
          <AlertDescription>Crea o seleziona un'azienda per gestire il cash flow.</AlertDescription>
        </Alert>
      </div>
    );
  }
  return (
    <div className="space-y-6 p-6">
      <header>
        <h1 className="text-xl font-semibold">Cash Flow</h1>
        <p className="text-sm text-muted-foreground">Movimenti, previsionale e categorie di {active.company.name}</p>
      </header>

      <Tabs defaultValue="movements" className="w-full">
        <TabsList>
          <TabsTrigger value="movements">Movimenti</TabsTrigger>
          <TabsTrigger value="forecast">Previsionale</TabsTrigger>
          <TabsTrigger value="categories">Categorie</TabsTrigger>
        </TabsList>

        <TabsContent value="movements" className="mt-6"><MovementsTab companyId={activeId} /></TabsContent>
        <TabsContent value="forecast" className="mt-6"><ForecastTab companyId={activeId} /></TabsContent>
        <TabsContent value="categories" className="mt-6"><CategoriesTab companyId={activeId} /></TabsContent>
      </Tabs>
    </div>
  );
}

// ===================== MOVEMENTS =====================
function MovementsTab({ companyId }: { companyId: string }) {
  const queryClient = useQueryClient();
  const fetchTx = useServerFn(listTransactions);
  const fetchCats = useServerFn(listCategories);
  const removeTx = useServerFn(deleteTransaction);

  const [typeFilter, setTypeFilter] = useState<"all" | "entrata" | "uscita">("all");
  const [showForecast, setShowForecast] = useState(true);
  const [editing, setEditing] = useState<(Partial<TransactionDraft> & { id?: string }) | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const txQuery = useQuery({
    queryKey: ["transactions", companyId, typeFilter, showForecast],
    queryFn: () => fetchTx({
      data: {
        company_id: companyId,
        type: typeFilter === "all" ? undefined : typeFilter,
        include_forecast: showForecast,
      },
    }),
  });
  const catsQuery = useQuery({
    queryKey: ["categories", companyId],
    queryFn: () => fetchCats({ data: { company_id: companyId } }),
  });

  const delMutation = useMutation({
    mutationFn: (id: string) => removeTx({ data: { id, company_id: companyId } }),
    onSuccess: () => {
      toast.success("Movimento eliminato");
      queryClient.invalidateQueries({ queryKey: ["transactions", companyId] });
      queryClient.invalidateQueries({ queryKey: ["cashflow-summary", companyId] });
      queryClient.invalidateQueries({ queryKey: ["forecast", companyId] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-kpis", companyId] });
    },
    onError: (err) => toast.error("Eliminazione fallita", { description: err instanceof Error ? err.message : "" }),
  });

  const rows = (txQuery.data ?? []) as Array<{
    id: string; date: string; description: string | null; category: string | null;
    type: string; amount: number; is_forecast: boolean; recurrence: string | null;
    counterpart: string | null; payment_method: string | null;
  }>;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <CardTitle>Elenco movimenti</CardTitle>
            <CardDescription>Entrate e uscite dell'azienda. Spunta "Mostra previsionali" per includere i pianificati.</CardDescription>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Tipo</Label>
              <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as "all" | "entrata" | "uscita")}>
                <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutti</SelectItem>
                  <SelectItem value="entrata">Solo entrate</SelectItem>
                  <SelectItem value="uscita">Solo uscite</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 pb-2">
              <Switch checked={showForecast} onCheckedChange={setShowForecast} id="show-forecast" />
              <Label htmlFor="show-forecast" className="text-xs">Mostra previsionali</Label>
            </div>
            <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
              <Plus className="mr-2 h-4 w-4" />Nuovo
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {txQuery.isLoading ? (
          <div className="flex justify-center p-8 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /></div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-8 text-center text-sm text-muted-foreground">
            <p>Nessun movimento da mostrare.</p>
            <Button variant="outline" size="sm" onClick={() => { setEditing(null); setDialogOpen(true); }}>
              <Plus className="mr-2 h-3.5 w-3.5" />Aggiungi il primo
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">Data</TableHead>
                <TableHead>Descrizione</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Controparte</TableHead>
                <TableHead className="text-right">Importo</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id} className={r.is_forecast ? "bg-muted/30" : undefined}>
                  <TableCell className="text-xs">{formatDate(r.date)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{r.description ?? "—"}</span>
                      {r.is_forecast && <Badge variant="outline" className="text-[10px]"><Clock className="mr-1 h-2.5 w-2.5" />Previsto</Badge>}
                      {r.recurrence && <Badge variant="outline" className="text-[10px]"><Repeat className="mr-1 h-2.5 w-2.5" />{r.recurrence === "monthly" ? "mens." : r.recurrence === "quarterly" ? "trim." : "ann."}</Badge>}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.category ?? "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.counterpart ?? "—"}</TableCell>
                  <TableCell className={`text-right tabular-nums font-medium ${r.type === "entrata" ? "text-emerald-500" : "text-rose-500"}`}>
                    {r.type === "entrata" ? "+" : "−"}{formatEUR(Number(r.amount))}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost" size="icon" className="h-7 w-7"
                        onClick={() => {
                          setEditing({
                            id: r.id,
                            type: r.type as "entrata" | "uscita",
                            amount: String(r.amount).replace(".", ","),
                            date: r.date,
                            description: r.description ?? "",
                            category: r.category ?? "",
                            counterpart: r.counterpart ?? "",
                            payment_method: r.payment_method ?? "bonifico",
                            is_forecast: r.is_forecast,
                            recurrence: (r.recurrence ?? "") as TransactionDraft["recurrence"],
                          });
                          setDialogOpen(true);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Elimina movimento?</AlertDialogTitle>
                            <AlertDialogDescription>Operazione irreversibile.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Annulla</AlertDialogCancel>
                            <AlertDialogAction onClick={() => delMutation.mutate(r.id)}>Elimina</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <TransactionFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        companyId={companyId}
        initial={editing ?? undefined}
        categories={(catsQuery.data ?? []).map((c) => ({ name: c.name as string, type: c.type as string }))}
      />
    </Card>
  );
}

// ===================== FORECAST =====================
function ForecastTab({ companyId }: { companyId: string }) {
  const fetchForecast = useServerFn(getForecast);
  const [days, setDays] = useState<30 | 60 | 90>(30);

  const fq = useQuery({
    queryKey: ["forecast", companyId, days],
    queryFn: () => fetchForecast({ data: { company_id: companyId, days } }),
  });

  const chartData = useMemo(() => {
    return (fq.data?.daily ?? []).map((d) => ({
      date: d.date,
      label: format(parseISO(d.date), "dd MMM", { locale: it }),
      balance: d.balance,
    }));
  }, [fq.data]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <CardTitle>Saldo proiettato</CardTitle>
              <CardDescription>
                Saldo di partenza + movimenti reali e previsti (inclusi ricorrenti) per i prossimi {days} giorni.
              </CardDescription>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Orizzonte</Label>
              <Select value={String(days)} onValueChange={(v) => setDays(Number(v) as 30 | 60 | 90)}>
                <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 giorni</SelectItem>
                  <SelectItem value="60">60 giorni</SelectItem>
                  <SelectItem value="90">90 giorni</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {fq.isLoading ? (
            <div className="flex h-[280px] items-center justify-center text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /></div>
          ) : (
            <>
              <div className="mb-4 grid grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground">Saldo oggi</div>
                  <div className="font-semibold tabular-nums">{formatEUR(fq.data?.opening_balance ?? 0)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Saldo a +{days}gg</div>
                  <div className="font-semibold tabular-nums">{formatEUR(fq.data?.closing_balance ?? 0)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Variazione</div>
                  <div className={`font-semibold tabular-nums ${(fq.data?.closing_balance ?? 0) - (fq.data?.opening_balance ?? 0) >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                    {formatEUR((fq.data?.closing_balance ?? 0) - (fq.data?.opening_balance ?? 0))}
                  </div>
                </div>
              </div>

              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={chartData} margin={{ top: 5, right: 12, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="balanceFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatEURCompact(v)} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                    formatter={(v: number) => [formatEUR(v), "Saldo"]}
                  />
                  <ReferenceLine y={0} stroke="hsl(var(--destructive))" strokeDasharray="2 4" />
                  <Area type="stepAfter" dataKey="balance" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#balanceFill)" />
                </AreaChart>
              </ResponsiveContainer>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Movimenti previsti</CardTitle>
          <CardDescription>
            Singoli movimenti pianificati + occorrenze proiettate delle ricorrenze attive.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {(fq.data?.items ?? []).length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nessun movimento previsto. Aggiungi un movimento "Previsionale" o imposta una ricorrenza.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[110px]">Data</TableHead>
                  <TableHead>Descrizione</TableHead>
                  <TableHead>Origine</TableHead>
                  <TableHead className="text-right">Importo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fq.data!.items.map((it, i) => (
                  <TableRow key={`${it.origin_id}-${i}`}>
                    <TableCell className="text-xs">{formatDate(it.date)}</TableCell>
                    <TableCell className="text-sm">{it.description ?? it.category ?? "Movimento"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">
                        {it.origin === "recurring" ? <><Repeat className="mr-1 h-2.5 w-2.5" />Ricorrente</> : <><Clock className="mr-1 h-2.5 w-2.5" />Una tantum</>}
                      </Badge>
                    </TableCell>
                    <TableCell className={`text-right tabular-nums font-medium ${it.type === "entrata" ? "text-emerald-500" : "text-rose-500"}`}>
                      {it.type === "entrata" ? <ArrowUp className="mr-1 inline h-3 w-3" /> : <ArrowDown className="mr-1 inline h-3 w-3" />}
                      {formatEUR(it.amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ===================== CATEGORIES =====================
function CategoriesTab({ companyId }: { companyId: string }) {
  const queryClient = useQueryClient();
  const fetchCats = useServerFn(listCategories);
  const saveCat = useServerFn(upsertCategory);
  const removeCat = useServerFn(deleteCategory);

  const [name, setName] = useState("");
  const [type, setType] = useState<"income" | "expense">("expense");
  const [color, setColor] = useState("#6366f1");

  const catsQuery = useQuery({
    queryKey: ["categories", companyId],
    queryFn: () => fetchCats({ data: { company_id: companyId } }),
  });

  const addMutation = useMutation({
    mutationFn: () => saveCat({ data: { company_id: companyId, name, type, color } }),
    onSuccess: () => {
      toast.success("Categoria aggiunta");
      setName("");
      queryClient.invalidateQueries({ queryKey: ["categories", companyId] });
    },
    onError: (err) => toast.error("Operazione fallita", { description: err instanceof Error ? err.message : "" }),
  });

  const delMutation = useMutation({
    mutationFn: (id: string) => removeCat({ data: { id } }),
    onSuccess: () => {
      toast.success("Categoria eliminata");
      queryClient.invalidateQueries({ queryKey: ["categories", companyId] });
    },
  });

  const rows = (catsQuery.data ?? []) as Array<{ id: string; name: string; type: string; color: string }>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Categorie</CardTitle>
        <CardDescription>Categorie personalizzate per classificare entrate e uscite.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-3 rounded-md border p-4 md:grid-cols-[1fr_140px_100px_auto]">
          <div className="space-y-1.5">
            <Label className="text-xs">Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="es. Marketing" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Tipo</Label>
            <Select value={type} onValueChange={(v) => setType(v as "income" | "expense")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="income">Entrata</SelectItem>
                <SelectItem value="expense">Uscita</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Colore</Label>
            <Input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10 p-1" />
          </div>
          <div className="flex items-end">
            <Button onClick={() => addMutation.mutate()} disabled={!name || addMutation.isPending}>
              {addMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Plus className="mr-1 h-4 w-4" />Aggiungi
            </Button>
          </div>
        </div>

        {rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Nessuna categoria definita.</p>
        ) : (
          <div className="grid gap-2 md:grid-cols-2">
            {rows.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-md border p-2.5">
                <div className="flex items-center gap-2.5">
                  <span className="h-3 w-3 rounded-sm" style={{ background: c.color }} />
                  <span className="text-sm">{c.name}</span>
                  <Badge variant="outline" className="text-[10px]">{c.type === "income" ? "Entrata" : "Uscita"}</Badge>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => delMutation.mutate(c.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
