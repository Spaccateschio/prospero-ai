import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type KpiCardProps = {
  label: string;
  value: string;
  deltaPct?: number | null;
  icon: LucideIcon;
  hint?: string;
  invertColor?: boolean; // per uscite/insoluti: delta positivo = rosso
};

export function KpiCard({ label, value, deltaPct, icon: Icon, hint, invertColor }: KpiCardProps) {
  const hasDelta = deltaPct !== undefined && deltaPct !== null && !Number.isNaN(deltaPct);
  const positive = hasDelta && (deltaPct as number) >= 0;
  const good = invertColor ? !positive : positive;

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="mt-3 text-2xl font-semibold tabular-nums">{value}</div>
        <div className="mt-2 flex items-center gap-2 text-xs">
          {hasDelta ? (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 rounded px-1.5 py-0.5",
                good
                  ? "bg-emerald-500/15 text-emerald-500"
                  : "bg-rose-500/15 text-rose-500",
              )}
            >
              {positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {Math.abs(deltaPct as number).toFixed(1)}%
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
          {hint && <span className="text-muted-foreground">{hint}</span>}
        </div>
      </CardContent>
    </Card>
  );
}
