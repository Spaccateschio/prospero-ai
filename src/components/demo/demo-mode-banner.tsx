import { Link } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";

export function DemoModeBanner() {
  return (
    <div className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 border-b border-amber-500/30 bg-amber-500/15 px-4 py-2 text-amber-950 backdrop-blur dark:text-amber-50">
      <div className="flex items-start gap-2 text-sm">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <span className="font-medium">Sei in modalità demo</span> — i dati non
          vengono salvati nel cloud. Se esci senza registrarti, perdi tutto.
        </div>
      </div>
      <Button asChild size="sm" className="shrink-0">
        <Link to="/auth">Crea account gratuito</Link>
      </Button>
    </div>
  );
}
