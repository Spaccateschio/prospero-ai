DROP POLICY IF EXISTS "Members can view their companies" ON public.companies;

CREATE POLICY "Members can view their companies"
  ON public.companies
  FOR SELECT
  TO authenticated
  USING (
    private.is_company_member(id, auth.uid())
    OR created_by = auth.uid()
  );