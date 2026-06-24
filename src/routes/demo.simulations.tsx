import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { formatEUR } from "@/lib/format";
import { useDemoKPIs } from "@/lib/demo-selectors";

export const Route = createFileRoute("/demo/simulations")({
  component: DemoSim,
});

function DemoSim() {
  const kpis = useDemoKPIs();
  const baseRevenue = kpis.revenue_month || 30000;
  const [growth, setGrowth] = useState([10]);
  const [costPct, setCostPct] = useState([65]);
  const [extraHires, setExtraHires] = useState(0);

  const projRevenue = baseRevenue * (1 + growth[0] / 100);
  const projCosts = projRevenue * (costPct[0] / 100) + extraHires * 3200;
  const projMargin = projRevenue - projCosts;

  return (
    <div className="space-y-6 p-6">
      <header>
        <h1 className="text-xl font-semibold">Simulazioni</h1>
        <p className="text-sm text-muted-foreground">Cosa succede se cambio le ipotesi?</p>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Ipotesi</CardTitle>
            <CardDescription>Modifica i parametri per vedere l'impatto</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <Label>Crescita fatturato: {growth[0]}%</Label>
              <Slider value={growth} onValueChange={setGrowth} min={-30} max={60} step={1} />
            </div>
            <div>
              <Label>Incidenza costi sul fatturato: {costPct[0]}%</Label>
              <Slider value={costPct} onValueChange={setCostPct} min={30} max={95} step={1} />
            </div>
            <div>
              <Label>Nuove assunzioni mensili (+€3.200 cad.)</Label>
              <Input type="number" min="0" max="20" value={extraHires} onChange={(e) => setExtraHires(parseInt(e.target.value) || 0)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Proiezione mensile</CardTitle>
            <CardDescription>Basata sull'ultimo mese di {formatEUR(baseRevenue)}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Row label="Fatturato previsto" value={projRevenue} positive />
            <Row label="Costi totali" value={-projCosts} />
            <div className="my-2 border-t" />
            <Row label="Margine operativo" value={projMargin} positive={projMargin >= 0} bold />
            <p className="text-xs text-muted-foreground">
              Margine % sul fatturato: {projRevenue ? ((projMargin / projRevenue) * 100).toFixed(1) : 0}%
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value, positive, bold }: { label: string; value: number; positive?: boolean; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={bold ? "font-semibold" : ""}>{label}</span>
      <span className={`tabular-nums ${bold ? "font-semibold text-lg" : ""} ${positive ? "text-emerald-600" : value < 0 ? "text-rose-600" : ""}`}>
        {formatEUR(value)}
      </span>
    </div>
  );
}
