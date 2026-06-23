
-- 1) Estensione tabella companies
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS legal_address_street text,
  ADD COLUMN IF NOT EXISTS pec_email text,
  ADD COLUMN IF NOT EXISTS sdi_code text,
  ADD COLUMN IF NOT EXISTS rea_code text,
  ADD COLUMN IF NOT EXISTS chamber_of_commerce text,
  ADD COLUMN IF NOT EXISTS ateco_description text,
  ADD COLUMN IF NOT EXISTS activity_status text,
  ADD COLUMN IF NOT EXISTS activity_start_date date,
  ADD COLUMN IF NOT EXISTS legal_form text,
  ADD COLUMN IF NOT EXISTS data_source text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS last_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS verification_provider text;

-- 2) Storico verifiche
CREATE TABLE IF NOT EXISTS public.company_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  vat_queried text NOT NULL,
  provider text NOT NULL,
  status text NOT NULL,
  raw_response jsonb,
  error_message text,
  requested_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.company_verifications TO authenticated;
GRANT ALL ON public.company_verifications TO service_role;

ALTER TABLE public.company_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read verifications" ON public.company_verifications
  FOR SELECT TO authenticated
  USING (company_id IS NULL AND requested_by = auth.uid()
         OR company_id IS NOT NULL AND private.is_company_member(company_id, auth.uid()));

CREATE POLICY "Members insert verifications" ON public.company_verifications
  FOR INSERT TO authenticated
  WITH CHECK (requested_by = auth.uid()
              AND (company_id IS NULL OR private.is_company_member(company_id, auth.uid())));

-- 3) Origine di ogni campo dell'anagrafica
CREATE TABLE IF NOT EXISTS public.company_field_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  field_name text NOT NULL,
  source text NOT NULL CHECK (source IN ('user', 'external', 'document')),
  provider text,
  verified_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, field_name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_field_sources TO authenticated;
GRANT ALL ON public.company_field_sources TO service_role;

ALTER TABLE public.company_field_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read field sources" ON public.company_field_sources
  FOR SELECT TO authenticated
  USING (private.is_company_member(company_id, auth.uid()));

CREATE POLICY "Members write field sources" ON public.company_field_sources
  FOR INSERT TO authenticated
  WITH CHECK (private.is_company_member(company_id, auth.uid()));

CREATE POLICY "Members update field sources" ON public.company_field_sources
  FOR UPDATE TO authenticated
  USING (private.is_company_member(company_id, auth.uid()));

CREATE POLICY "Owners/admins delete field sources" ON public.company_field_sources
  FOR DELETE TO authenticated
  USING (private.has_company_any_role(company_id, auth.uid(),
         ARRAY['owner'::app_role, 'admin'::app_role]));

CREATE TRIGGER update_company_field_sources_updated_at
  BEFORE UPDATE ON public.company_field_sources
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) Documenti caricati manualmente
CREATE TABLE IF NOT EXISTS public.company_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  doc_type text NOT NULL CHECK (doc_type IN ('visura', 'bilancio', 'atto', 'statuto', 'altro')),
  title text NOT NULL,
  storage_path text NOT NULL,
  file_size bigint,
  mime_type text,
  document_date date,
  notes text,
  uploaded_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_documents TO authenticated;
GRANT ALL ON public.company_documents TO service_role;

ALTER TABLE public.company_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read documents" ON public.company_documents
  FOR SELECT TO authenticated
  USING (private.is_company_member(company_id, auth.uid()));

CREATE POLICY "Members upload documents" ON public.company_documents
  FOR INSERT TO authenticated
  WITH CHECK (uploaded_by = auth.uid()
              AND private.is_company_member(company_id, auth.uid()));

CREATE POLICY "Uploader or admins update documents" ON public.company_documents
  FOR UPDATE TO authenticated
  USING (uploaded_by = auth.uid()
         OR private.has_company_any_role(company_id, auth.uid(),
            ARRAY['owner'::app_role, 'admin'::app_role]));

CREATE POLICY "Uploader or admins delete documents" ON public.company_documents
  FOR DELETE TO authenticated
  USING (uploaded_by = auth.uid()
         OR private.has_company_any_role(company_id, auth.uid(),
            ARRAY['owner'::app_role, 'admin'::app_role]));

CREATE TRIGGER update_company_documents_updated_at
  BEFORE UPDATE ON public.company_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_company_documents_company ON public.company_documents(company_id);
CREATE INDEX IF NOT EXISTS idx_company_field_sources_company ON public.company_field_sources(company_id);
CREATE INDEX IF NOT EXISTS idx_company_verifications_company ON public.company_verifications(company_id);
