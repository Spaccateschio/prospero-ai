import { createFileRoute } from "@tanstack/react-router";
import { ExternalLink, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";

export const Route = createFileRoute("/demo/opportunities")({
  component: DemoOpps,
});

const opps = [
  { name: "Credito d'imposta R&S 2026", entity: "Agenzia delle Entrate", max: 200000, match: 92, tag: "Innovazione", end: "31/12/2026" },
  { name: "Bando Digital PMI Lazio", entity: "Regione Lazio", max: 50000, match: 87, tag: "Digitalizzazione", end: "30/09/2026" },
  { name: "Voucher Internazionalizzazione", entity: "MIMIT", max: 30000, match: 74, tag: "Export", end: "15/11/2026" },
  { name: "Nuova Sabatini", entity: "MIMIT", max: 150000, match: 68, tag: "Beni strumentali", end: "Sportello aperto" },
];

function DemoOpps() {
  return (
    <div className="space-y-6 p-6">
      <header className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-primary" />
        <div>
          <h1 className="text-xl font-semibold">Centro Opportunità</h1>
          <p className="text-sm text-muted-foreground">Bandi e incentivi compatibili con ACME Srl</p>
        </div>
      </header>

      <div className="grid gap-3 lg:grid-cols-2">
        {opps.map((o) => (
          <Card key={o.name}>
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-base">{o.name}</CardTitle>
                  <CardDescription>{o.entity} · scade {o.end}</CardDescription>
                </div>
                <Badge variant="secondary" className="bg-emerald-500/15 text-emerald-600">
                  Match {o.match}%
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <div className="text-sm">
                Importo massimo: <span className="font-semibold">{o.max.toLocaleString("it-IT")} €</span>
                <div className="mt-1"><Badge variant="outline">{o.tag}</Badge></div>
              </div>
              <Button variant="outline" size="sm">
                Scopri <ExternalLink className="ml-2 h-3.5 w-3.5" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
