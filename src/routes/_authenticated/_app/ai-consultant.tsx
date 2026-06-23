import { createFileRoute } from "@tanstack/react-router";
import { Bot } from "lucide-react";

import { ComingSoon } from "@/components/coming-soon";

export const Route = createFileRoute("/_authenticated/_app/ai-consultant")({
  component: () => (
    <ComingSoon
      title="Consulente AI"
      description="CFO virtuale powered by Claude — analisi proattive e chat in italiano."
      icon={Bot}
      phase={9}
      features={[
        "Chat con persona CFO senior in italiano",
        "Diagnosi proattive settimanali: cali fatturato, margini, clienti inattivi, rischio liquidità",
        "Ogni suggerimento è una bozza che approvi tu",
        "Cita i tuoi dati reali in ogni risposta",
        "Genera piani d'azione 3-5 step con priorità e impatto stimato",
      ]}
    />
  ),
});
