CREATE TABLE public.financial_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'banca' CHECK (kind IN ('banca', 'cassa_contanti', 'cassa_assegni', 'altro')),
  opening_balance NUMERIC(15,2) NOT NULL DEFAULT 0,
  opening_balance_date DATE NOT NULL DEFAULT CURRENT_DATE,
  color TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_financial_resources_company ON public.financial_resources(company_id, position);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.financial_resources TO authenticated;
GRANT ALL ON public.financial_resources TO service_role;

ALTER TABLE public.financial_resources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read financial_resources" ON public.financial_resources FOR SELECT TO authenticated
  USING (private.is_company_member(company_id, auth.uid()));
CREATE POLICY "Members insert financial_resources" ON public.financial_resources FOR INSERT TO authenticated
  WITH CHECK (private.has_company_any_role(company_id, auth.uid(), ARRAY['owner'::app_role,'admin'::app_role,'accountant'::app_role]));
CREATE POLICY "Members update financial_resources" ON public.financial_resources FOR UPDATE TO authenticated
  USING (private.has_company_any_role(company_id, auth.uid(), ARRAY['owner'::app_role,'admin'::app_role,'accountant'::app_role]));
CREATE POLICY "Members delete financial_resources" ON public.financial_resources FOR DELETE TO authenticated
  USING (private.has_company_any_role(company_id, auth.uid(), ARRAY['owner'::app_role,'admin'::app_role]));

CREATE TRIGGER trg_financial_resources_updated_at BEFORE UPDATE ON public.financial_resources
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS resource_id UUID REFERENCES public.financial_resources(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_resource ON public.transactions(resource_id) WHERE resource_id IS NOT NULL;

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS resource_id UUID REFERENCES public.financial_resources(id) ON DELETE SET NULL;