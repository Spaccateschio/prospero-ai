import { createFileRoute } from "@tanstack/react-router";
import { FlaskConical } from "lucide-react";

import { ComingSoon } from "@/components/coming-soon";

export const Route = createFileRoute("/_authenticated/_app/simulations")({
  component: () => (
    <ComingSoon
      title="Simulazioni"
      description="Scenari what-if isolati dai dati reali."
      icon={FlaskConical}
      phase={8}
      features={[
        "8 tipi di scenario: nuovo cliente/dipendente/veicolo/finanziamento, variazione prezzi, espansione, cost saving, cambio fornitore",
        "Confronto Before / After fianco a fianco",
        "Overlay sul cash flow esistente",
        "ROI, breakeven, payback period",
        '"Promote to real data" quando lo scenario è confermato',
      ]}
    />
  ),
});
