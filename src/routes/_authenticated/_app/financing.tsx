import { createFileRoute } from "@tanstack/react-router";
import { Banknote } from "lucide-react";

import { ComingSoon } from "@/components/coming-soon";

export const Route = createFileRoute("/_authenticated/_app/financing")({
  component: () => (
    <ComingSoon
      title="Finanziamenti"
      description="Schede mutui con simulatori e alert di rifinanziamento."
      icon={Banknote}
      phase={4}
      features={[
        "Card per ogni mutuo con progresso rate e prossima scadenza",
        "Simulatore estinzione anticipata: nuovo residuo + interessi risparmiati",
        "Alert rifinanziamento quando i tassi di mercato scendono",
        "Riepilogo: debito totale, rata mensile totale, prossima scadenza",
      ]}
    />
  ),
});
