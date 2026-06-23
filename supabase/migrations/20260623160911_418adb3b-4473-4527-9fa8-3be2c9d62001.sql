
-- 1. Extend invoice_status enum
ALTER TYPE public.invoice_status ADD VALUE IF NOT EXISTS 'partially_paid';

-- 2. Extend invoices
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS paid_amount numeric(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS notes_internal text;

-- 3. Extend loans
ALTER TABLE public.loans
  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS frequency text NOT NULL DEFAULT 'monthly'
    CHECK (frequency IN ('monthly','quarterly','yearly')),
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','paid_off','defaulted'));

-- 4. Extend companies
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS cashflow_alert_threshold numeric(15,2);

-- 5. Extend transactions with origin tracking (anti-duplicate for future Open Banking)
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS origin text NOT NULL DEFAULT 'manual'
    CHECK (origin IN ('manual','invoice','loan','deadline','import','bank_sync')),
  ADD COLUMN IF NOT EXISTS source_invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_loan_id uuid REFERENCES public.loans(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_deadline_id uuid;

CREATE INDEX IF NOT EXISTS idx_transactions_source_invoice ON public.transactions(source_invoice_id) WHERE source_invoice_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_source_loan ON public.transactions(source_loan_id) WHERE source_loan_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_source_deadline ON public.transactions(source_deadline_id) WHERE source_deadline_id IS NOT NULL;

-- 6. Deadline kind enum
DO $$ BEGIN
  CREATE TYPE public.deadline_kind AS ENUM ('tax','contract','payment','admin','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 7. Drop old tax_deadlines (verified empty)
DROP TABLE IF EXISTS public.tax_deadlines CASCADE;

-- 8. Unified deadlines table
CREATE TABLE public.deadlines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  kind public.deadline_kind NOT NULL DEFAULT 'other',
  category text,
  title text NOT NULL,
  description text,
  due_date date NOT NULL,
  estimated_amount numeric(15,2),
  actual_amount numeric(15,2),
  confidence public.tax_confidence NOT NULL DEFAULT 'medium',
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','paid','overdue','cancelled')),
  paid_at timestamptz,
  notify_days_before integer NOT NULL DEFAULT 7,
  recurrence text CHECK (recurrence IN ('monthly','quarterly','yearly')),
  is_demo boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_deadlines_company_due ON public.deadlines(company_id, due_date);
CREATE INDEX idx_deadlines_status ON public.deadlines(company_id, status) WHERE status IN ('pending','overdue');

GRANT SELECT, INSERT, UPDATE, DELETE ON public.deadlines TO authenticated;
GRANT ALL ON public.deadlines TO service_role;

ALTER TABLE public.deadlines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read deadlines" ON public.deadlines FOR SELECT
  USING (private.is_company_member(company_id, auth.uid()));

CREATE POLICY "Members write deadlines" ON public.deadlines FOR INSERT
  WITH CHECK (private.has_company_any_role(company_id, auth.uid(), ARRAY['owner'::app_role,'admin'::app_role,'accountant'::app_role]));

CREATE POLICY "Members update deadlines" ON public.deadlines FOR UPDATE
  USING (private.has_company_any_role(company_id, auth.uid(), ARRAY['owner'::app_role,'admin'::app_role,'accountant'::app_role]));

CREATE POLICY "Members delete deadlines" ON public.deadlines FOR DELETE
  USING (private.has_company_any_role(company_id, auth.uid(), ARRAY['owner'::app_role,'admin'::app_role]));

CREATE TRIGGER update_deadlines_updated_at
  BEFORE UPDATE ON public.deadlines
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 9. Now that deadlines exists, add the FK on transactions.source_deadline_id
ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_source_deadline_fkey
  FOREIGN KEY (source_deadline_id) REFERENCES public.deadlines(id) ON DELETE SET NULL;
