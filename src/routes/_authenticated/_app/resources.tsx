import { createFileRoute } from "@tanstack/react-router";

import { ResourcesList } from "@/components/resources/resources-list";

export const Route = createFileRoute("/_authenticated/_app/resources")({
  component: ResourcesPage,
});

function ResourcesPage() {
  return <ResourcesList />;
}
