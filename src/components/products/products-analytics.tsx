import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { format, parse } from "date-fns";
import { it } from "date-fns/locale";
import {
  CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Loader2, AlertCircle, Search, Upload, Package, TrendingUp, Users2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

import { useActiveCompany } from "@/hooks/use-companies";
import { formatEUR, formatEURCompact } from "@/lib/format";
import { getProductAnalytics, type ProductStat, type ClientProductStat } from "@/lib/products.functions";
import { ProductSalesImportDialog } from "@/components/products/import-dialog";

export function ProductsAnalytics() {
  const { activeId, active, isLoading } = useActiveCompany();
  const [search, setSearch] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const fetchAnalytics = useServerFn(getProductAnalytics);

  const { data, isLoading: loadingData } = useQuery({
    queryKey: ["product_analytics", activeId],
    queryFn: async () => {
      if (!activeId) return null;
      return (await fetchAnalytics({ data: { company_id: activeId } })) as {
        products: ProductStat[];
        clientProducts: ClientProductStat[];
        priceTrend: Array<{ month: string; avg_price: number }>;
        rowsCount: number;
      };
    },
    enabled: !!activeId,
  });

  const filteredProducts = useMemo(() => {
    const list = data?.products ?? [];
    if (!search.trim()) return list;
    const q = search.trim().toLowerCase();
    return list.filter((p) => p.product_name.toLowerCase().includes(q));
  }, [data, search]);

  const topClientsForSelected = useMemo(() => {
    if (!selectedProduct || !data) return [];
    return data.clientProducts
      .filter((cp) => cp.product_name === selectedProduct)
      .sort((a, b) => b.total_amount - a.total_amount)
      .slice(0, 10);
  }, [selectedProduct, data]);

  const priceTrendChart = useMemo(
    () => (data?.priceTrend ?? []).map((p) => ({
      month: p.month,
      label: format(parse(`${p.month}-01`, "yyyy-MM-dd", new Date()), "MMM yy", { locale: it }),
      avg_price: p.avg_price,
    })),
    [data],
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
          <AlertDescription>Crea o seleziona un'azienda per vedere l'analisi prodotti.</AlertDescription>
        </Alert>
      </div>
    );
  }

  const hasData = (data?.rowsCount ?? 0) > 0;

  return (
    <div className="space-y-6 p-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">Prodotti</h1>
          <p className="text-sm text-muted-foreground">
            {active.company.name} · Chi compra cosa, quanto e a che prezzo
          </p>
        </div>
        <Button onClick={() => setImportOpen(true)}>
          <Upload className="mr-2 h-4 w-4" /> Importa movimenti
        </Button>
      </header>

      {!hasData ? (
        <Card>
          <CardContent className="flex h-48 flex-col items-center justify-center gap-3 text-center text-sm text-muted-foreground">
            <Package className="h-8 w-8" />
            <p>Nessun movimento prodotto importato ancora.</p>
            <Button size="sm" onClick={() => setImportOpen(true)}>
              <Upload className="mr-2 h-4 w-4" /> Importa il primo file
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Prodotti diversi venduti</CardDescription>
                <CardTitle className="text-2xl tabular-nums">{data?.products.length ?? 0}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Fatturato totale movimenti</CardDescription>
                <CardTitle className="text-2xl tabular-nums">
                  {formatEUR((data?.products ?? []).reduce((s, p) => s + p.total_amount, 0))}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Righe movimento analizzate</CardDescription>
                <CardTitle className="text-2xl tabular-nums">{data?.rowsCount ?? 0}</CardTitle>
              </CardHeader>
            </Card>
          </div>

          {priceTrendChart.length > 1 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" /> Prezzo medio mensile (tutti i prodotti)
                </CardTitle>
                <CardDescription>Media pesata per quantità venduta, mese per mese</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={priceTrendChart} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis dataKey="label" fontSize={12} />
                      <YAxis fontSize={12} tickFormatter={(v) => formatEURCompact(v)} />
                      <Tooltip formatter={(v: number) => formatEUR(v)} />
                      <Line type="monotone" dataKey="avg_price" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} name="Prezzo medio" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-base">Prodotti più venduti</CardTitle>
                  <CardDescription>Ordinati per fatturato · clicca una riga per vedere chi lo acquista di più</CardDescription>
                </div>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Cerca prodotto…"
                    className="pl-8"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loadingData ? (
                <div className="flex h-32 items-center justify-center text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Prodotto</TableHead>
                        <TableHead>Categoria</TableHead>
                        <TableHead className="text-right">Quantità</TableHead>
                        <TableHead className="text-right">Fatturato</TableHead>
                        <TableHead className="text-right">Prezzo medio</TableHead>
                        <TableHead className="text-right">N. clienti</TableHead>
                        <TableHead>Top cliente</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredProducts.slice(0, 100).map((p) => (
                        <TableRow
                          key={p.product_name}
                          className="cursor-pointer"
                          data-state={selectedProduct === p.product_name ? "selected" : undefined}
                          onClick={() => setSelectedProduct(p.product_name === selectedProduct ? null : p.product_name)}
                        >
                          <TableCell className="font-medium">{p.product_name}</TableCell>
                          <TableCell>
                            {p.category ? <Badge variant="outline" className="text-xs">{p.category}</Badge> : "—"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {p.total_quantity.toLocaleString("it-IT", { maximumFractionDigits: 2 })} {p.unit ?? ""}
                          </TableCell>
                          <TableCell className="text-right tabular-nums font-medium">{formatEUR(p.total_amount)}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatEUR(p.avg_price)}</TableCell>
                          <TableCell className="text-right tabular-nums">{p.clients_count}</TableCell>
                          <TableCell className="truncate text-xs text-muted-foreground">{p.top_client ?? "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {selectedProduct && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Users2 className="h-4 w-4" /> Chi acquista "{selectedProduct}"
                </CardTitle>
                <CardDescription>Clienti ordinati per fatturato su questo prodotto</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead className="text-right">Quantità</TableHead>
                      <TableHead className="text-right">Fatturato</TableHead>
                      <TableHead className="text-right">Prezzo medio pagato</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topClientsForSelected.map((cp) => (
                      <TableRow key={cp.counterpart_name}>
                        <TableCell className="font-medium">{cp.counterpart_name}</TableCell>
                        <TableCell className="text-right tabular-nums">{cp.total_quantity.toLocaleString("it-IT", { maximumFractionDigits: 2 })}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatEUR(cp.total_amount)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatEUR(cp.avg_price)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </>
      )}

      <ProductSalesImportDialog open={importOpen} onOpenChange={setImportOpen} companyId={activeId} />
    </div>
  );
}
