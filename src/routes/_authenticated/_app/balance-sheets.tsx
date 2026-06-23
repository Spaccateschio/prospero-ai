import { createFileRoute } from "@tanstack/react-router";
import { FileBarChart2 } from "lucide-react";

import { ComingSoon } from "@/components/coming-soon";

export const Route = createFileRoute("/_authenticated/_app/balance-sheets")({
  component: () => (
    <ComingSoon
      title="Bilanci Storici"
      description="Multi-anno con analisi AI, KPI automatici e Health Score retroattivo."
      icon={FileBarChart2}
      phase={3}
      features={[
        "Upload PDF / Excel / XBRL con estrazione AI",
        "Flow guidati per Agenzia Entrate e Camera di Commercio",
        "KPI auto-calcolati: ROE, ROI, current ratio, debt-to-equity, DSO",
        "Trend multi-anno: ricavi, EBITDA, utile netto",
        "Commento AI in italiano + Health Score retroattivo",
      ]}
    />
  ),
});
