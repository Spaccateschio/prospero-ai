import { createFileRoute } from "@tanstack/react-router";
import { LayoutDashboard } from "lucide-react";

import { ComingSoon } from "@/components/coming-soon";

export const Route = createFileRoute("/_authenticated/_app/dashboard")({
  component: () => (
    <ComingSoon
      title="Dashboard"
      description="Widget personalizzabili con i tuoi indicatori chiave."
      icon={LayoutDashboard}
      phase={1}
      features={[
        "Griglia widget drag & drop con ridimensionamento",
        "16+ widget: cash flow, scadenze fiscali, top clienti, salute aziendale",
        "Tab e gruppi personalizzati",
        "Libreria widget con add/remove/reset layout",
      ]}
    />
  ),
});
