import type { LucideIcon } from "lucide-react";
import { Construction } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Props = {
  title: string;
  description: string;
  icon?: LucideIcon;
  phase?: number;
  features?: readonly string[];
};

export function ComingSoon({ title, description, icon: Icon = Construction, phase, features = [] }: Props) {
  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        {phase ? (
          <Badge variant="secondary" className="shrink-0">
            Fase {phase}
          </Badge>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base">Modulo in arrivo</CardTitle>
              <CardDescription>
                Questa sezione verrà implementata in una fase successiva del progetto.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        {features.length > 0 ? (
          <CardContent>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Cosa includerà
            </p>
            <ul className="space-y-1.5 text-sm">
              {features.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        ) : null}
      </Card>
    </div>
  );
}
