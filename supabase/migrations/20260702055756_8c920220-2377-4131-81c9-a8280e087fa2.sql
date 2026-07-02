CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  code TEXT,
  name TEXT NOT NULL,
  category TEXT,
  default_unit TEXT,
  last_unit_price NUMERIC(15,4),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_products_company ON public.products(company_id);
CREATE UNIQUE INDEX idx_products_dedup_code ON public.products(company_id, code) WHERE code IS NOT NULL AND code <> '';
CREATE UNIQUE INDEX idx_products_dedup_name ON public.products(company_id, name) WHERE code IS NULL OR code = '';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read products" ON public.products FOR SELECT TO authenticated
  USING (private.is_company_member(company_id, auth.uid()));
CREATE POLICY "Members insert products" ON public.products FOR INSERT TO authenticated
  WITH CHECK (private.has_company_any_role(company_id, auth.uid(), ARRAY['owner'::app_role,'admin'::app_role,'accountant'::app_role]));
CREATE POLICY "Members update products" ON public.products FOR UPDATE TO authenticated
  USING (private.has_company_any_role(company_id, auth.uid(), ARRAY['owner'::app_role,'admin'::app_role,'accountant'::app_role]));
CREATE POLICY "Members delete products" ON public.products FOR DELETE TO authenticated
  USING (private.has_company_any_role(company_id, auth.uid(), ARRAY['owner'::app_role,'admin'::app_role]));

CREATE TRIGGER trg_products_updated_at BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.product_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  product_code TEXT,
  category TEXT,
  unit TEXT,
  sale_date DATE NOT NULL,
  counterpart_name TEXT NOT NULL,
  quantity NUMERIC(15,3) NOT NULL,
  unit_price NUMERIC(15,4) NOT NULL,
  total_amount NUMERIC(15,2) NOT NULL,
  reference_doc TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_product_sales_company_date ON public.product_sales(company_id, sale_date);
CREATE INDEX idx_product_sales_product ON public.product_sales(company_id, product_name);
CREATE INDEX idx_product_sales_counterpart ON public.product_sales(company_id, counterpart_name);
CREATE UNIQUE INDEX idx_product_sales_dedup
  ON public.product_sales(company_id, reference_doc, product_name, sale_date, quantity, unit_price)
  WHERE reference_doc IS NOT NULL AND reference_doc <> '';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_sales TO authenticated;
GRANT ALL ON public.product_sales TO service_role;

ALTER TABLE public.product_sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read product_sales" ON public.product_sales FOR SELECT TO authenticated
  USING (private.is_company_member(company_id, auth.uid()));
CREATE POLICY "Members insert product_sales" ON public.product_sales FOR INSERT TO authenticated
  WITH CHECK (private.has_company_any_role(company_id, auth.uid(), ARRAY['owner'::app_role,'admin'::app_role,'accountant'::app_role]));
CREATE POLICY "Members update product_sales" ON public.product_sales FOR UPDATE TO authenticated
  USING (private.has_company_any_role(company_id, auth.uid(), ARRAY['owner'::app_role,'admin'::app_role,'accountant'::app_role]));
CREATE POLICY "Members delete product_sales" ON public.product_sales FOR DELETE TO authenticated
  USING (private.has_company_any_role(company_id, auth.uid(), ARRAY['owner'::app_role,'admin'::app_role]));