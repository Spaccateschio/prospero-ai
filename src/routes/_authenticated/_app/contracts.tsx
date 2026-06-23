import { createFileRoute } from "@tanstack/react-router";
import { FileSignature } from "lucide-react";

import { ComingSoon } from "@/components/coming-soon";

export const Route = createFileRoute("/_authenticated/_app/contracts")({
  component: () => (
    <ComingSoon
      title="Gestione Contratti"
      description="Repository fornitori con estrazione AI clausole e confronto preventivi."
      icon={FileSignature}
      phase={7}
      features={[
        "Upload PDF con estrazione AI di durata, valore, rinnovo, clausole, penali",
        "Alert pre-rinnovo automatico configurabile per contratto",
        "Vista calendario contratti in scadenza",
        "Confronto preventivi (2-4) con raccomandazione AI",
        "Integrazione Cost Monitor: 'tuo contratto in scadenza — rinegozia ora'",
      ]}
    />
  ),
});
