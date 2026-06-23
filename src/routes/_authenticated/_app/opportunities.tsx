import { createFileRoute } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";

import { ComingSoon } from "@/components/coming-soon";

export const Route = createFileRoute("/_authenticated/_app/opportunities")({
  component: () => (
    <ComingSoon
      title="Centro Opportunità"
      description="Risparmi, recupero clienti, fornitori alternativi e bandi — tutto in un hub."
      icon={Sparkles}
      phase={6}
      features={[
        "Risparmi dal Cost Monitor ordinati per impatto",
        "Recupero clienti inattivi con messaggi AI (drafts)",
        "Suggerimenti fornitori alternativi per categoria",
        "Bandi & incentivi italiani con motore di idoneità per la tua azienda",
        "Opportunità AI: prodotti/servizi più redditizi, nuovi segmenti",
      ]}
    />
  ),
});
