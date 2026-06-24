import { createFileRoute } from "@tanstack/react-router";
import { Bot, Send, User } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

import { formatEUR } from "@/lib/format";
import { useDemoKPIs } from "@/lib/demo-selectors";

export const Route = createFileRoute("/demo/ai-consultant")({
  component: DemoAI,
});

type Msg = { role: "user" | "ai"; text: string };

function DemoAI() {
  const kpis = useDemoKPIs();
  const [msgs, setMsgs] = useState<Msg[]>([
    {
      role: "ai",
      text: `Ciao, sono il tuo consulente AI demo. In base ai dati di ACME Srl: fatturato del mese ${formatEUR(kpis.revenue_month)}, cash flow ${formatEUR(kpis.cashflow_month)}, ${kpis.open_invoices_count} fatture aperte per ${formatEUR(kpis.open_invoices_total)}. Chiedimi qualcosa.`,
    },
  ]);
  const [input, setInput] = useState("");

  function send() {
    if (!input.trim()) return;
    const q = input.trim();
    setMsgs((m) => [...m, { role: "user", text: q }]);
    setInput("");
    setTimeout(() => {
      const lower = q.toLowerCase();
      let answer = "In modalità demo le mie risposte sono limitate a calcoli locali sui tuoi dati. Prova a chiedere: 'come va il cash flow?' o 'quante fatture scadute ho?'.";
      if (lower.includes("cash") || lower.includes("liquidità")) {
        answer = `Il cash flow del mese corrente è ${formatEUR(kpis.cashflow_month)}. ${kpis.cashflow_month_delta_pct !== null ? `Variazione vs mese precedente: ${kpis.cashflow_month_delta_pct.toFixed(1)}%.` : ""}`;
      } else if (lower.includes("fatture aperte") || lower.includes("scadut")) {
        answer = `Hai ${kpis.open_invoices_count} fatture aperte per un totale di ${formatEUR(kpis.open_invoices_total)}, di cui ${kpis.overdue_count} scadute (${formatEUR(kpis.overdue_total)}).`;
      } else if (lower.includes("uscit") || lower.includes("spes")) {
        answer = `Nei prossimi 30 giorni hai ${kpis.upcoming_expenses.length} uscite pianificate per ${formatEUR(kpis.upcoming_expenses.reduce((s, e) => s + e.amount, 0))}.`;
      }
      setMsgs((m) => [...m, { role: "ai", text: answer }]);
    }, 400);
  }

  return (
    <div className="space-y-6 p-6">
      <header className="flex items-center gap-2">
        <Bot className="h-5 w-5 text-primary" />
        <div>
          <h1 className="text-xl font-semibold">Consulente AI</h1>
          <p className="text-sm text-muted-foreground">Risposte basate sui dati demo</p>
        </div>
      </header>

      <Card className="flex h-[60vh] flex-col">
        <CardHeader>
          <CardTitle className="text-base">Chat</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col gap-3 overflow-y-auto">
          {msgs.map((m, i) => (
            <div key={i} className={`flex items-start gap-2 ${m.role === "user" ? "justify-end" : ""}`}>
              {m.role === "ai" && <Bot className="mt-1 h-4 w-4 text-primary shrink-0" />}
              <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${m.role === "ai" ? "bg-muted" : "bg-primary text-primary-foreground"}`}>
                {m.text}
              </div>
              {m.role === "user" && <User className="mt-1 h-4 w-4 shrink-0" />}
            </div>
          ))}
        </CardContent>
        <div className="flex gap-2 border-t p-3">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") send(); }}
            placeholder="Chiedi qualcosa sui tuoi numeri..."
          />
          <Button onClick={send}><Send className="h-4 w-4" /></Button>
        </div>
      </Card>
    </div>
  );
}
