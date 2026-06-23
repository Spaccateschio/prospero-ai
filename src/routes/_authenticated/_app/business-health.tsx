import { createFileRoute } from "@tanstack/react-router";
import { HeartPulse } from "lucide-react";

import { ComingSoon } from "@/components/coming-soon";

export const Route = createFileRoute("/_authenticated/_app/business-health")({
  component: () => (
    <ComingSoon
      title="Salute Aziendale"
      description="Score 0-100 con sotto-indicatori, benchmark di settore e simulatore credito."
      icon={HeartPulse}
      phase={10}
      features={[
        "Gauge 0-100 con 6 sotto-indicatori (liquidità, profittabilità, clienti, debito, fisco, crescita)",
        "Trend storico 12 mesi (incluso retroattivo dai bilanci)",
        "Benchmark settoriale anonimizzato",
        "Simulatore credit score: probabilità approvazione mutuo/fido/leasing/factoring",
        '"Top 3 cose da fare questo mese" generate dall\'AI',
        "Widget carbon footprint integrato (ESG)",
      ]}
    />
  ),
});
