import { createFileRoute } from "@tanstack/react-router";
import { Settings as SettingsIcon } from "lucide-react";

import { ComingSoon } from "@/components/coming-soon";

export const Route = createFileRoute("/_authenticated/_app/settings")({
  component: () => (
    <ComingSoon
      title="Impostazioni"
      description="Profilo, sicurezza, team, integrazioni e configurazione azienda."
      icon={SettingsIcon}
      features={[
        "Profilo utente e preferenze",
        "2FA (TOTP) e log audit",
        "Gestione team e inviti (con permessi commercialista configurabili)",
        "Integrazioni: Open Banking, PEC, WhatsApp Business",
        "Dati azienda: regime fiscale, IVA, certificazioni ISO",
      ]}
    />
  ),
});
