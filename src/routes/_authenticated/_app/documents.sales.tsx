import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Upload, Loader2, AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

import { useActiveCompany } from "@/hooks/use-companies";
import { formatEUR, formatDate } from "@/lib/format";
import { listInvoices } from "@/lib/invoices.functions";
import { PdfImportDialog } from "@/components/documents/pdf-import-dialog";

export const Route = createFileRoute("/_authenticated/_app/documents/sales")({
  component: SalesDocumentsPage,
});

function SalesDocumentsPage() {
  return <DocsList direction="attiva" mode="sales" title="Fatture Emesse" />;
}

export function DocsList({
  direction,
  mode,
  title,
}: {
  direction: "attiva" | "passiva";
  mode: "sales" | "purchases" | "other";
  title: string;
}) {
  const { activeId, active, isLoading } = useActiveCompany();
  const [importOpen, setImportOpen] = useState(false);
  const fetchInvoices = useServerFn(listInvoices);

  const { data: rows, isLoading: loadingRows } = useQuery({
    queryKey: ["invoices", activeId, direction, mode],
    queryFn: async () => {
      if (!activeId) return [];
      return (await fetchInvoices({ data: { company_id: activeId, direction } })) as unknown as Array<{
        id: string;
        number: string | null;
        document_type: string;
        counterpart_name: string;
        issue_date: string | null;
        total_amount: number;
        effective_status: string;
      }>;
    },
    enabled: !!activeId,
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

  const filtered = mode === "other"
    ? (rows ?? []).filter((r) => r.document_type !== "fattura")
    : (rows ?? []);

  const total = filtered.reduce((s, r) => s + Number(r.total_amount || 0), 0);

  return (
    <div className="space-y-6 p-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">{title}</h1>
          <p className="text-sm text-muted-foreground">
            {active.company.name} · {filtered.length} documenti · {formatEUR(total)}
          </p>
        </div>
        <Button onClick={() => setImportOpen(true)}>
          <Upload className="mr-2 h-4 w-4" /> Importa da PDF
        </Button>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Elenco documenti</CardTitle>
          <CardDescription>
            Carica un PDF (fattura singola o elenco) e l'AI estrae automaticamente tutti i campi.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingRows ? (
            <div className="flex h-32 items-center justify-center text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center gap-3 text-center text-sm text-muted-foreground">
              <p>Nessun documento. Importa il tuo primo PDF per iniziare.</p>
              <Button size="sm" onClick={() => setImportOpen(true)}>
                <Upload className="mr-2 h-4 w-4" /> Importa PDF
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Numero</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>{direction === "attiva" ? "Cliente" : "Fornitore"}</TableHead>
                    <TableHead className="text-right">Totale</TableHead>
                    <TableHead>Stato</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {r.document_type.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{r.number ?? "—"}</TableCell>
                      <TableCell>{formatDate(r.issue_date)}</TableCell>
                      <TableCell className="font-medium">{r.counterpart_name}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatEUR(Number(r.total_amount))}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">
                          {r.effective_status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <PdfImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        companyId={activeId}
        mode={mode}
      />
    </div>
  );
}
