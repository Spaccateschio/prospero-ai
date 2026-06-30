DROP INDEX IF EXISTS public.idx_invoices_dedup;
CREATE UNIQUE INDEX idx_invoices_dedup
  ON public.invoices (company_id, direction, document_type, number, issue_date);