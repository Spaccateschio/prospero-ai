
-- ============ DOCUMENT TYPE ENUM ============
DO $$ BEGIN
  CREATE TYPE public.document_type AS ENUM ('fattura', 'parcella', 'nota_credito', 'ricevuta', 'ddt');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS document_type public.document_type NOT NULL DEFAULT 'fattura';

CREATE INDEX IF NOT EXISTS idx_invoices_company_doctype ON public.invoices(company_id, document_type);

-- ============ TAX PAYMENTS (F24) ============
CREATE TABLE IF NOT EXISTS public.tax_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  payment_date date NOT NULL,
  total_amount numeric(15,2) NOT NULL,
  protocol text,
  sections jsonb NOT NULL DEFAULT '[]'::jsonb,
  file_url text,
  notes text,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tax_payments TO authenticated;
GRANT ALL ON public.tax_payments TO service_role;

ALTER TABLE public.tax_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read tax_payments" ON public.tax_payments
  FOR SELECT TO authenticated
  USING (private.is_company_member(company_id, auth.uid()));

CREATE POLICY "Members insert tax_payments" ON public.tax_payments
  FOR INSERT TO authenticated
  WITH CHECK (private.is_company_member(company_id, auth.uid()));

CREATE POLICY "Members update tax_payments" ON public.tax_payments
  FOR UPDATE TO authenticated
  USING (private.has_company_any_role(company_id, auth.uid(), ARRAY['owner'::app_role, 'admin'::app_role, 'accountant'::app_role]));

CREATE POLICY "Members delete tax_payments" ON public.tax_payments
  FOR DELETE TO authenticated
  USING (private.has_company_any_role(company_id, auth.uid(), ARRAY['owner'::app_role, 'admin'::app_role]));

CREATE INDEX IF NOT EXISTS idx_tax_payments_company_date ON public.tax_payments(company_id, payment_date DESC);

CREATE TRIGGER trg_tax_payments_updated_at
  BEFORE UPDATE ON public.tax_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
