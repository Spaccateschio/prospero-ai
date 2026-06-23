import { createFileRoute } from "@tanstack/react-router";
import { TrendingUp } from "lucide-react";

import { ComingSoon } from "@/components/coming-soon";

export const Route = createFileRoute("/_authenticated/_app/cash-flow")({
  component: () => (
    <ComingSoon
      title="Cash Flow"
      description="Previsione di cassa giornaliera, settimanale, mensile e annuale."
      icon={TrendingUp}
      phase={1}
      features={[
        "Doppia linea: confermato (solida) ed estimato (tratteggiata)",
        "Grafico waterfall per il dettaglio mensile",
        '"What if" toggle per simulare l\'impatto di una categoria',
        "Export PDF/Excel",
      ]}
    />
  ),
});
