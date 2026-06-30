import { createFileRoute } from "@tanstack/react-router";

import { DocsList } from "@/components/documents/docs-list";

export const Route = createFileRoute("/_authenticated/_app/documents/sales")({
  component: SalesDocumentsPage,
});

function SalesDocumentsPage() {
  return <DocsList direction="attiva" mode="sales" title="Fatture Emesse" />;
}
