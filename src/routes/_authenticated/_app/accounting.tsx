import { createFileRoute } from "@tanstack/react-router";
import { ReceiptText } from "lucide-react";

import { ComingSoon } from "@/components/coming-soon";

export const Route = createFileRoute("/_authenticated/_app/accounting")({
  component: () => (
    <ComingSoon
      title="Contabilità"
      description="Import multi-canale, AI categorization, riconciliazione bancaria."
      icon={ReceiptText}
      phase={2}
      features={[
        "Import SDI XML, Excel/CSV, PDF/foto con OCR, PEC/IMAP, Open Banking",
        "Inbox triage con AI auto-categorization",
        "Smart reconciliation: match estratti conto ↔ fatture",
        "Liste transazioni e fatture (attive/passive) con filtri",
        "P&L mensile/trimestrale/annuale + breakdown costi",
      ]}
    />
  ),
});
