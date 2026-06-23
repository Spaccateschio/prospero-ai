import { createFileRoute } from "@tanstack/react-router";
import { CalendarClock } from "lucide-react";

import { ComingSoon } from "@/components/coming-soon";

export const Route = createFileRoute("/_authenticated/_app/tax-calendar")({
  component: () => (
    <ComingSoon
      title="Calendario Fiscale"
      description="IVA, IRES/IRPEF, INPS, IMU, TARI e scadenze custom."
      icon={CalendarClock}
      phase={4}
      features={[
        "Stima importo con confidenza (alta/media/bassa)",
        "Countdown + notifiche push/email configurabili",
        "Vista calendario e vista lista",
        '"Segna come pagato" one-click',
        "Colori: verde pagato, ambra entro 30gg, rosso in ritardo",
      ]}
    />
  ),
});
