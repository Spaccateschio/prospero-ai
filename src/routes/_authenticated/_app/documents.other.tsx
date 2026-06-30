import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Upload, Loader2, AlertCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

import { useActiveCompany } from "@/hooks/use-companies";
import { formatEUR, formatDate } from "@/lib/format";
import { listInvoices } from "@/lib/invoices.functions";
import { listTaxPayments, deleteTaxPayment } from "@/lib/documents.functions";
import { PdfImportDialog } from "@/components/documents/pdf-import-dialog";

export const Route = createFileRoute("/_authenticated/_app/documents/other")({
  component: OtherDocsPage,
});

function OtherDocsPage() {
  const { activeId, active, isLoading } = useActiveCompany();
  const [importOpen, setImportOpen] = useState(false);
  const queryClient = useQueryClient();

  const fetchInvoices = useServerFn(listInvoices);
  const fetchTax = useServerFn(listTaxPayments);
  const delTax = useServerFn(deleteTaxPayment);

  const { data: docs } = useQuery({
    queryKey: ["invoices", activeId, "other"],
    queryFn: async () => {
      if (!activeId) return [];
      const all = (await fetchInvoices({ data: { company_id: activeId } })) as unknown as Array<{
        id: string;
        document_type: string;
        number: string | null;
        counterpart_name: string;
        issue_date: string | null;
        total_amount: number;
        direction: string;
      }>;
      return all.filter((r) => r.document_type !== "fattura");
    },
    enabled: !!activeId,
  });

  const { data: f24s } = useQuery({
    queryKey: ["tax_payments", activeId],
    queryFn: async () => {
      if (!activeId) return [];
      return await fetchTax({ data: { company_id: activeId } });
    },
    enabled: !!activeId,
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      if (!activeId) return;
      await delTax({ data: { id, company_id: activeId } });
    },
    onSuccess: () => {
      toast.success("F24 eliminato");
      queryClient.invalidateQueries({ queryKey: ["tax_payments", activeId] });
    },
  });

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
          <AlertDescription>Crea o seleziona un'azienda per gestire i documenti.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Altri Documenti</h1>
          <p className="text-sm text-muted-foreground">
            DDT, parcelle, ricevute, note di credito e F24 — {active.company.name}
          </p>
        </div>
        <Button onClick={() => setImportOpen(true)}>
          <Upload className="mr-2 h-4 w-4" /> Importa da PDF
        </Button>
      </header>

      <Tabs defaultValue="docs">
        <TabsList>
          <TabsTrigger value="docs">DDT / Parcelle / Ricevute ({docs?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="f24">F24 ({f24s?.length ?? 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="docs" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Documenti vari</CardTitle>
              <CardDescription>Tutti i documenti non-fattura emessi o ricevuti.</CardDescription>
            </CardHeader>
            <CardContent>
              {!docs || docs.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Nessun documento.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Numero</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Controparte</TableHead>
                      <TableHead>Dir.</TableHead>
                      <TableHead className="text-right">Totale</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {docs.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {r.document_type.replace("_", " ")}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{r.number ?? "—"}</TableCell>
                        <TableCell>{formatDate(r.issue_date)}</TableCell>
                        <TableCell className="font-medium">{r.counterpart_name}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{r.direction === "attiva" ? "Att" : "Pas"}</Badge>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatEUR(Number(r.total_amount))}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="f24" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">F24 versati</CardTitle>
              <CardDescription>Versamenti unificati con dettaglio sezioni.</CardDescription>
            </CardHeader>
            <CardContent>
              {!f24s || f24s.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Nessun F24 registrato.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data versamento</TableHead>
                      <TableHead>Protocollo</TableHead>
                      <TableHead>Sezioni</TableHead>
                      <TableHead className="text-right">Totale</TableHead>
                      <TableHead className="w-8"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {f24s.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>{formatDate(r.payment_date)}</TableCell>
                        <TableCell className="font-mono text-xs">{r.protocol ?? "—"}</TableCell>
                        <TableCell className="text-xs">{Array.isArray(r.sections) ? r.sections.length : 0}</TableCell>
                        <TableCell className="text-right tabular-nums font-medium">
                          {formatEUR(Number(r.total_amount))}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => deleteMut.mutate(r.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <PdfImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        companyId={activeId}
        mode="other"
      />
    </div>
  );
}
