import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, AlertCircle, Plus, Pencil, Copy, Trash2, Landmark, Wallet, FileCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { useActiveCompany } from "@/hooks/use-companies";
import { formatEUR, formatDate } from "@/lib/format";
import {
  listFinancialResources, upsertFinancialResource, deleteFinancialResource,
  type FinancialResourceRow,
} from "@/lib/resources.functions";
import { ResourceFormDialog } from "@/components/resources/resource-form-dialog";

const KIND_ICON: Record<string, typeof Landmark> = {
  banca: Landmark,
  cassa_contanti: Wallet,
  cassa_assegni: FileCheck,
  altro: Wallet,
};

const KIND_LABELS: Record<string, string> = {
  banca: "Banca",
  cassa_contanti: "Cassa Contanti",
  cassa_assegni: "Cassa Assegni",
  altro: "Altro",
};

export function ResourcesList() {
  const { activeId, active, isLoading } = useActiveCompany();
  const queryClient = useQueryClient();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<FinancialResourceRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FinancialResourceRow | null>(null);

  const fetchResources = useServerFn(listFinancialResources);
  const upsert = useServerFn(upsertFinancialResource);
  const remove = useServerFn(deleteFinancialResource);

  const { data: resources, isLoading: loadingResources } = useQuery({
    queryKey: ["financial_resources", activeId],
    queryFn: async () => {
      if (!activeId) return [];
      return (await fetchResources({ data: { company_id: activeId } })) as FinancialResourceRow[];
    },
    enabled: !!activeId,
  });

  const duplicateMut = useMutation({
    mutationFn: (r: FinancialResourceRow) =>
      upsert({
        data: {
          company_id: activeId!,
          name: `${r.name} (copia)`,
          kind: r.kind,
          opening_balance: r.opening_balance,
          opening_balance_date: r.opening_balance_date,
          notes: r.notes,
        },
      }),
    onSuccess: () => {
      toast.success("Risorsa duplicata");
      queryClient.invalidateQueries({ queryKey: ["financial_resources", activeId] });
    },
    onError: (e) => toast.error("Errore duplicazione", { description: e instanceof Error ? e.message : "" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => remove({ data: { id, company_id: activeId! } }),
    onSuccess: () => {
      toast.success("Risorsa eliminata");
      queryClient.invalidateQueries({ queryKey: ["financial_resources", activeId] });
      setDeleteTarget(null);
    },
    onError: (e) => toast.error("Errore eliminazione", { description: e instanceof Error ? e.message : "" }),
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
          <AlertDescription>Crea o seleziona un'azienda per gestire le risorse finanziarie.</AlertDescription>
        </Alert>
      </div>
    );
  }

  const totalBalance = (resources ?? []).reduce((s, r) => s + r.current_balance, 0);

  return (
    <div className="space-y-6 p-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Risorse Finanziarie</h1>
          <p className="text-sm text-muted-foreground">
            {active.company.name} · Banche, casse e disponibilità liquide
          </p>
        </div>
        <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" /> Nuova risorsa
        </Button>
      </header>

      <Card>
        <CardHeader className="pb-2">
          <CardDescription>Liquidità totale</CardDescription>
          <CardTitle className="text-3xl tabular-nums">{formatEUR(totalBalance)}</CardTitle>
        </CardHeader>
      </Card>

      {loadingResources ? (
        <div className="flex h-32 items-center justify-center text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      ) : !resources || resources.length === 0 ? (
        <Card>
          <CardContent className="flex h-40 flex-col items-center justify-center gap-3 text-center text-sm text-muted-foreground">
            <p>Nessuna risorsa finanziaria. Crea Banca 1, Banca 2, Cassa Assegni, Cassa Contanti…</p>
            <Button size="sm" onClick={() => { setEditing(null); setFormOpen(true); }}>
              <Plus className="mr-2 h-4 w-4" /> Crea la prima risorsa
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {resources.map((r) => {
            const Icon = KIND_ICON[r.kind] ?? Wallet;
            return (
              <Card key={r.id}>
                <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <CardTitle className="text-sm">{r.name}</CardTitle>
                      <Badge variant="outline" className="mt-1 text-[10px]">{KIND_LABELS[r.kind]}</Badge>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => { setEditing(r); setFormOpen(true); }}>
                        <Pencil className="mr-2 h-3.5 w-3.5" /> Modifica
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => duplicateMut.mutate(r)}>
                        <Copy className="mr-2 h-3.5 w-3.5" /> Duplica
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => setDeleteTarget(r)}
                      >
                        <Trash2 className="mr-2 h-3.5 w-3.5" /> Elimina
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-semibold tabular-nums ${r.current_balance < 0 ? "text-destructive" : ""}`}>
                    {formatEUR(r.current_balance)}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Saldo iniziale {formatEUR(r.opening_balance)} il {formatDate(r.opening_balance_date)}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <ResourceFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        companyId={activeId}
        resource={editing}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              I movimenti collegati a questa risorsa non verranno eliminati, ma perderanno il collegamento. Questa azione non può essere annullata.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}
            >
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
