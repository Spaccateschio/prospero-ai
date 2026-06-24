import { useNavigate } from "@tanstack/react-router";
import { Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useIsDemo } from "@/hooks/use-profile";

/**
 * Banner persistente mostrato nella shell quando l'utente è in modalità prova.
 * Invita a registrarsi per salvare i dati e sbloccare tutte le funzioni.
 */
export function DemoBanner() {
  const isDemo = useIsDemo();
  const navigate = useNavigate();
  if (!isDemo) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-100">
      <Sparkles className="h-3.5 w-3.5 shrink-0" />
      <span className="flex-1 min-w-0">
        <strong>Modalità prova:</strong> stai esplorando con dati di esempio.
        Registrati per salvare i tuoi dati reali e sbloccare tutte le funzioni.
      </span>
      <Button
        size="sm"
        className="h-7 px-3 text-xs"
        onClick={() => navigate({ to: "/auth" })}
      >
        Registrati ora
      </Button>
    </div>
  );
}
