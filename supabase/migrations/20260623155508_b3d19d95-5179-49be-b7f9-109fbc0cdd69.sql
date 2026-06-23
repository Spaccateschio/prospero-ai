-- 1. Extend transactions
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS is_forecast boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recurrence text,
  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

ALTER TABLE public.transactions
  DROP CONSTRAINT IF EXISTS transactions_recurrence_check;
ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_recurrence_check
  CHECK (recurrence IS NULL OR recurrence IN ('monthly','quarterly','yearly'));

CREATE INDEX IF NOT EXISTS idx_transactions_company_forecast
  ON public.transactions (company_id, is_forecast, date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_company_recurrence
  ON public.transactions (company_id, recurrence)
  WHERE recurrence IS NOT NULL;

-- 2. Extend invoices
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

-- 3. transaction_categories
CREATE TABLE IF NOT EXISTS public.transaction_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('income','expense')),
  color text NOT NULL DEFAULT '#6366f1',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (company_id, name, type)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.transaction_categories TO authenticated;
GRANT ALL ON public.transaction_categories TO service_role;

ALTER TABLE public.transaction_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read categories"
  ON public.transaction_categories FOR SELECT TO authenticated
  USING (private.is_company_member(company_id, auth.uid()));

CREATE POLICY "Owners/admins insert categories"
  ON public.transaction_categories FOR INSERT TO authenticated
  WITH CHECK (private.has_company_any_role(company_id, auth.uid(), ARRAY['owner'::app_role,'admin'::app_role]));

CREATE POLICY "Owners/admins update categories"
  ON public.transaction_categories FOR UPDATE TO authenticated
  USING (private.has_company_any_role(company_id, auth.uid(), ARRAY['owner'::app_role,'admin'::app_role]));

CREATE POLICY "Owners/admins delete categories"
  ON public.transaction_categories FOR DELETE TO authenticated
  USING (private.has_company_any_role(company_id, auth.uid(), ARRAY['owner'::app_role,'admin'::app_role]));

CREATE TRIGGER trg_transaction_categories_updated_at
  BEFORE UPDATE ON public.transaction_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();