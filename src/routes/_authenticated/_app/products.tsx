import { createFileRoute } from "@tanstack/react-router";

import { ProductsAnalytics } from "@/components/products/products-analytics";

export const Route = createFileRoute("/_authenticated/_app/products")({
  component: ProductsPage,
});

function ProductsPage() {
  return <ProductsAnalytics />;
}
