import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, AlertCircle, Search, Users, Truck } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

import { useActiveCompany } from "@/hooks/use-companies";
import { formatEUR, formatDate } from "@/lib/format";
import { listCounterparts, type CounterpartRow } from "@/lib/counterparts.functions";

type FilterType = "cliente" | "fornitore";

export function CounterpartsList() {
  const { activeId, active, isLoading } = useActiveCompany();
  const [type, setType] = useState<FilterType>("cliente");
  const [search, setSearch] = useState("");
  const fetchCounterparts = useServerFn(listCounterparts);

  const { data: rows, isLoading: loadingRows } = useQuery({
    queryKey: ["counterparts", activeId],
    queryFn: async () => {
      if (!activeId) return [];
      return (await fetchCounterparts({ data: { company_id: activeId, type: "all" } })) as CounterpartRow[];
    },
    enabled: !!activeId,
  });

  const filtered = useMemo(() => {
    const base = (rows ?? []).filter((r) => r.type === type);
    if (!search.trim()) return base;
    const q = search.trim().toLowerCase();
    return base.filter(
      (r) => r.name.toLowerCase().includes(q) || (r.vat ?? "").toLowerCase().includes(q),
    );
  }, [rows, type, search]);

  const clientiCount = (rows ?? []).filter((r) => r.type === "cliente").length;
  const fornitoriCount = (rows ?? []).filter((r) => r.type === "fornitore").length;

  const totals = filtered.reduce(
    (acc, r) => ({
      total: acc.total + r.total_amount,
      open: acc.open + r.open_balance,
      overdue: acc.overdue + r.overdue_amount,
    }),
    { total: 0, open: 0, overdue: 0 },
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    );
  }
  if (!activeId || !active) {
    return (
      <div className="p-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Nessuna azienda selezionata</AlertTitle>
          <AlertDescription>Crea o seleziona un'azienda per vedere clienti e fornitori.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">Clienti e Fornitori</h1>
          <p className="text-sm text-muted-foreground">
            {active.company.name} · Anagrafica generata automaticamente dai documenti caricati
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cerca per nome o P.IVA…"
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </header>

      <Tabs value={type} onValueChange={(v) => setType(v as FilterType)}>
        <TabsList>
          <TabsTrigger value="cliente" className="gap-2">
            <Users className="h-4 w-4" /> Clienti
            <Badge variant="secondary" className="ml-1">{clientiCount}</Badge>
          </TabsTrigger>
          <TabsTrigger value="fornitore" className="gap-2">
            <Truck className="h-4 w-4" /> Fornitori
            <Badge variant="secondary" className="ml-1">{fornitoriCount}</Badge>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Totale fatturato ({type === "cliente" ? "clienti" : "fornitori"})</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{formatEUR(totals.total)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Saldo aperto</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{formatEUR(totals.open)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Di cui scaduto</CardDescription>
            <CardTitle className="text-2xl tabular-nums text-destructive">{formatEUR(totals.overdue)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {type === "cliente" ? "Elenco Clienti" : "Elenco Fornitori"}
          </CardTitle>
          <CardDescription>
            {filtered.length} {type === "cliente" ? "clienti" : "fornitori"} · ordinati per fatturato
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingRows ? (
            <div className="flex h-32 items-center justify-center text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex h-32 flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
              <p>
                Nessun {type === "cliente" ? "cliente" : "fornitore"} trovato.
                {search ? " Prova a modificare la ricerca." : " Importa dei documenti per popolare l'elenco."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>P.IVA</TableHead>
                    <TableHead className="text-right">N. Documenti</TableHead>
                    <TableHead className="text-right">Totale</TableHead>
                    <TableHead className="text-right">Saldo aperto</TableHead>
                    <TableHead className="text-right">Scaduto</TableHead>
                    <TableHead>Ultimo documento</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => (
                    <TableRow key={r.key}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{r.vat ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.documents_count}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatEUR(r.total_amount)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {r.open_balance > 0 ? formatEUR(r.open_balance) : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {r.overdue_amount > 0 ? (
                          <Badge variant="destructive" className="font-normal">
                            {formatEUR(r.overdue_amount)}
                          </Badge>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>{formatDate(r.last_document_date)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
