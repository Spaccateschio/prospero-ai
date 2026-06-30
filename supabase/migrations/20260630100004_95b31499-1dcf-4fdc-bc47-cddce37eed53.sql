CREATE TABLE public.import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  filename TEXT,
  hint_direction TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  total_chunks INTEGER NOT NULL DEFAULT 0,
  processed_chunks INTEGER NOT NULL DEFAULT 0,
  failed_chunks INTEGER NOT NULL DEFAULT 0,
  inserted_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_import_jobs_company ON public.import_jobs(company_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_jobs TO authenticated;
GRANT ALL ON public.import_jobs TO service_role;

ALTER TABLE public.import_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read import_jobs" ON public.import_jobs FOR SELECT TO authenticated
  USING (private.is_company_member(company_id, auth.uid()));
CREATE POLICY "Members insert import_jobs" ON public.import_jobs FOR INSERT TO authenticated
  WITH CHECK (private.is_company_member(company_id, auth.uid()) AND created_by = auth.uid());
CREATE POLICY "Members update import_jobs" ON public.import_jobs FOR UPDATE TO authenticated
  USING (private.is_company_member(company_id, auth.uid()));
CREATE POLICY "Members delete import_jobs" ON public.import_jobs FOR DELETE TO authenticated
  USING (private.is_company_member(company_id, auth.uid()));

CREATE TRIGGER trg_import_jobs_updated_at BEFORE UPDATE ON public.import_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE UNIQUE INDEX idx_invoices_dedup
  ON public.invoices(company_id, direction, document_type, number, issue_date)
  WHERE number IS NOT NULL AND issue_date IS NOT NULL;