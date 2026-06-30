import { createFileRoute } from "@tanstack/react-router";

import { DocsList } from "./documents.sales";

export const Route = createFileRoute("/_authenticated/_app/documents/purchases")({
  component: PurchasesPage,
});

function PurchasesPage() {
  return <DocsList direction="passiva" mode="purchases" title="Fatture Ricevute" />;
}
