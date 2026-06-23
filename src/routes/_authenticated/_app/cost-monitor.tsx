import { createFileRoute } from "@tanstack/react-router";
import { LineChart } from "lucide-react";

import { ComingSoon } from "@/components/coming-soon";

export const Route = createFileRoute("/_authenticated/_app/cost-monitor")({
  component: () => (
    <ComingSoon
      title="Monitoraggio Costi di Mercato"
      description="Carburanti, energia, gas, telco, banche — risparmi identificati dall'AI."
      icon={LineChart}
      phase={5}
      features={[
        "Carburanti via Osservatorio MASE — stazioni più economiche per zona",
        "Bollette luce/gas con OCR e confronto offerte di mercato",
        "Telecomunicazioni: confronto offerte business",
        "Servizi bancari: commissioni, POS, bonifici",
        "Savings Report aggregato con impatto su cash flow e P&L",
      ]}
    />
  ),
});
