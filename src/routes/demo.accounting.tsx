import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

import { formatDate, formatEUR } from "@/lib/format";
import { useDemoStore } from "@/lib/demo-store";

export const Route = createFileRoute("/demo/accounting")({
  component: DemoAccounting,
});

function StatusBadge({ s }: { s: string }) {
  const map: Record<string, string> = {
    paid: "bg-emerald-500/15 text-emerald-600",
    sent: "bg-blue-500/15 text-blue-600",
    overdue: "bg-rose-500/15 text-rose-600",
    draft: "bg-muted text-muted-foreground",
  };
  const label = { paid: "Pagata", sent: "Inviata", overdue: "Scaduta", draft: "Bozza" }[s] ?? s;
  return <Badge variant="secondary" className={map[s] ?? ""}>{label}</Badge>;
}

function DemoAccounting() {
  const invoices = useDemoStore((s) => s.invoices);
  const [open, setOpen] = useState(false);
  const [direction, setDirection] = useState<"attiva" | "passiva">("attiva");

  const list = invoices.filter((i) => i.direction === direction);
  const total = list.reduce((s, i) => s + i.total_amount, 0);
  const unpaid = list.filter((i) => i.status !== "paid").reduce((s, i) => s + i.total_amount, 0);

  return (
    <div className="space-y-6 p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Contabilità</h1>
          <p className="text-sm text-muted-foreground">Fatture attive e passive</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nuova fattura
        </Button>
      </header>

      <Tabs value={direction} onValueChange={(v) => setDirection(v as "attiva" | "passiva")}>
        <TabsList>
          <TabsTrigger value="attiva">Vendite ({invoices.filter((i) => i.direction === "attiva").length})</TabsTrigger>
          <TabsTrigger value="passiva">Acquisti ({invoices.filter((i) => i.direction === "passiva").length})</TabsTrigger>
        </TabsList>

        <TabsContent value={direction} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Card><CardContent className="p-4"><div className="text-xs uppercase text-muted-foreground">Totale</div><div className="mt-1 text-xl font-semibold">{formatEUR(total)}</div></CardContent></Card>
            <Card><CardContent className="p-4"><div className="text-xs uppercase text-muted-foreground">Da incassare/pagare</div><div className="mt-1 text-xl font-semibold">{formatEUR(unpaid)}</div></CardContent></Card>
            <Card><CardContent className="p-4"><div className="text-xs uppercase text-muted-foreground">Numero fatture</div><div className="mt-1 text-xl font-semibold">{list.length}</div></CardContent></Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Elenco fatture</CardTitle>
              <CardDescription>Dati di esempio — modifiche salvate solo nel browser</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Numero</TableHead>
                    <TableHead>{direction === "attiva" ? "Cliente" : "Fornitore"}</TableHead>
                    <TableHead>Emissione</TableHead>
                    <TableHead>Scadenza</TableHead>
                    <TableHead className="text-right">Totale</TableHead>
                    <TableHead>Stato</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.map((i) => (
                    <TableRow key={i.id}>
                      <TableCell className="font-mono text-xs">{i.number}</TableCell>
                      <TableCell>{i.counterpart_name}</TableCell>
                      <TableCell>{formatDate(i.issue_date)}</TableCell>
                      <TableCell>{formatDate(i.due_date)}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium">{formatEUR(i.total_amount)}</TableCell>
                      <TableCell><StatusBadge s={i.status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <NewInvoiceDialog open={open} onOpenChange={setOpen} defaultDirection={direction} />
    </div>
  );
}

function NewInvoiceDialog({
  open, onOpenChange, defaultDirection,
}: { open: boolean; onOpenChange: (v: boolean) => void; defaultDirection: "attiva" | "passiva" }) {
  const addInvoice = useDemoStore((s) => s.addInvoice);
  const [direction, setDirection] = useState<"attiva" | "passiva">(defaultDirection);
  const [number, setNumber] = useState("");
  const [counterpart, setCounterpart] = useState("");
  const [amount, setAmount] = useState("");
  const [vat, setVat] = useState("22");
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString().slice(0, 10);
  });

  function submit() {
    const a = parseFloat(amount);
    const v = parseFloat(vat);
    if (!a || a <= 0 || !number || !counterpart) return;
    const vatAmount = a * (v / 100);
    addInvoice({
      direction, number, counterpart_name: counterpart,
      amount: a, vat_amount: vatAmount, total_amount: a + vatAmount,
      issue_date: issueDate, due_date: dueDate, paid_date: null, status: "sent",
    });
    setNumber(""); setCounterpart(""); setAmount("");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Nuova fattura (demo)</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Tipo</Label>
              <Select value={direction} onValueChange={(v) => setDirection(v as "attiva" | "passiva")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="attiva">Vendita</SelectItem>
                  <SelectItem value="passiva">Acquisto</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Numero</Label>
              <Input value={number} onChange={(e) => setNumber(e.target.value)} placeholder="2026/006" />
            </div>
          </div>
          <div>
            <Label>{direction === "attiva" ? "Cliente" : "Fornitore"}</Label>
            <Input value={counterpart} onChange={(e) => setCounterpart(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Imponibile (€)</Label>
              <Input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div>
              <Label>IVA (%)</Label>
              <Input type="number" min="0" step="1" value={vat} onChange={(e) => setVat(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Emissione</Label>
              <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
            </div>
            <div>
              <Label>Scadenza</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annulla</Button>
          <Button onClick={submit}>Salva (solo demo)</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
