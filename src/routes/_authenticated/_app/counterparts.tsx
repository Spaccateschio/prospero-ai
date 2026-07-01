import { createFileRoute } from "@tanstack/react-router";

import { CounterpartsList } from "@/components/counterparts/counterparts-list";

export const Route = createFileRoute("/_authenticated/_app/counterparts")({
  component: CounterpartsPage,
});

function CounterpartsPage() {
  return <CounterpartsList />;
}
