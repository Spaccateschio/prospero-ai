
-- =====================================================
-- ENUMS
-- =====================================================
CREATE TYPE public.app_role AS ENUM ('owner', 'admin', 'accountant', 'viewer');
CREATE TYPE public.regime_fiscale AS ENUM ('ordinario', 'semplificato', 'forfettario', 'agricolo');
CREATE TYPE public.iva_frequency AS ENUM ('mensile', 'trimestrale', 'annuale');
CREATE TYPE public.company_type AS ENUM ('srl', 'srls', 'spa', 'sapa', 'snc', 'sas', 'ditta_individuale', 'cooperativa', 'altro');
CREATE TYPE public.transaction_type AS ENUM ('entrata', 'uscita');
CREATE TYPE public.transaction_status AS ENUM ('pending', 'confirmed', 'reconciled');
CREATE TYPE public.invoice_direction AS ENUM ('attiva', 'passiva');
CREATE TYPE public.invoice_status AS ENUM ('draft', 'sent', 'paid', 'overdue', 'cancelled');
CREATE TYPE public.loan_rate_type AS ENUM ('fisso', 'variabile', 'misto');
CREATE TYPE public.tax_status AS ENUM ('upcoming', 'paid', 'overdue');
CREATE TYPE public.tax_confidence AS ENUM ('high', 'medium', 'low');
CREATE TYPE public.simulation_status AS ENUM ('draft', 'reviewed', 'promoted', 'archived');
CREATE TYPE public.contract_status AS ENUM ('active', 'expiring_soon', 'expired', 'under_renegotiation');
CREATE TYPE public.opportunity_status AS ENUM ('new', 'in_review', 'simulated', 'applied', 'dismissed');
CREATE TYPE public.diagnosis_severity AS ENUM ('critical', 'warning', 'info');
CREATE TYPE public.access_request_status AS ENUM ('pending', 'approved', 'rejected', 'expired');
CREATE TYPE public.grant_type AS ENUM ('fondo_perduto', 'credito_imposta', 'finanziamento_agevolato', 'garanzia', 'misto');

-- =====================================================
-- PROFILES
-- =====================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  phone TEXT,
  locale TEXT NOT NULL DEFAULT 'it',
  two_factor_enabled BOOLEAN NOT NULL DEFAULT false,
  onboarding_completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'));
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Generic updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- COMPANIES
-- =====================================================
CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  legal_name TEXT,
  vat TEXT,
  fiscal_code TEXT,
  ateco TEXT,
  sector TEXT,
  region TEXT,
  province TEXT,
  city TEXT,
  zip_code TEXT,
  regime_fiscale public.regime_fiscale,
  iva_frequency public.iva_frequency,
  company_type public.company_type,
  founded_year INTEGER,
  employees_count INTEGER,
  annual_revenue NUMERIC(15,2),
  iso_certifications JSONB NOT NULL DEFAULT '[]'::jsonb,
  logo_url TEXT,
  require_accountant_approval BOOLEAN NOT NULL DEFAULT false,
  accountant_approval_timeout_hours INTEGER NOT NULL DEFAULT 24,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.companies TO authenticated;
GRANT ALL ON public.companies TO service_role;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_companies_updated_at BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- COMPANY_USERS (membership)
-- =====================================================
CREATE TABLE public.company_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'viewer',
  permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
  invited_by UUID REFERENCES auth.users(id),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, user_id)
);
CREATE INDEX idx_company_users_user ON public.company_users(user_id);
CREATE INDEX idx_company_users_company ON public.company_users(company_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_users TO authenticated;
GRANT ALL ON public.company_users TO service_role;
ALTER TABLE public.company_users ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- SECURITY DEFINER HELPERS
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_user_company_ids(_user_id UUID)
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM public.company_users WHERE user_id = _user_id;
$$;

CREATE OR REPLACE FUNCTION public.is_company_member(_company_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.company_users
    WHERE company_id = _company_id AND user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.has_company_role(_company_id UUID, _user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.company_users
    WHERE company_id = _company_id AND user_id = _user_id AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.has_company_any_role(_company_id UUID, _user_id UUID, _roles public.app_role[])
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.company_users
    WHERE company_id = _company_id AND user_id = _user_id AND role = ANY(_roles)
  );
$$;

-- Companies policies
CREATE POLICY "Members can view their companies" ON public.companies
  FOR SELECT TO authenticated USING (public.is_company_member(id, auth.uid()));
CREATE POLICY "Users can create companies" ON public.companies
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Owners and admins can update company" ON public.companies
  FOR UPDATE TO authenticated
  USING (public.has_company_any_role(id, auth.uid(), ARRAY['owner','admin']::public.app_role[]));
CREATE POLICY "Owners can delete company" ON public.companies
  FOR DELETE TO authenticated
  USING (public.has_company_role(id, auth.uid(), 'owner'));

-- Company users policies
CREATE POLICY "Members can view memberships of their companies" ON public.company_users
  FOR SELECT TO authenticated USING (public.is_company_member(company_id, auth.uid()));
CREATE POLICY "Users can insert themselves as owner when creating company" ON public.company_users
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owners and admins can manage memberships" ON public.company_users
  FOR UPDATE TO authenticated
  USING (public.has_company_any_role(company_id, auth.uid(), ARRAY['owner','admin']::public.app_role[]));
CREATE POLICY "Owners and admins can remove memberships" ON public.company_users
  FOR DELETE TO authenticated
  USING (public.has_company_any_role(company_id, auth.uid(), ARRAY['owner','admin']::public.app_role[]));

-- =====================================================
-- GENERIC COMPANY-SCOPED TABLES
-- Helper macro pattern repeated below
-- =====================================================

-- ACCOUNTANT ACCESS REQUESTS
CREATE TABLE public.accountant_access_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  accountant_user_id UUID NOT NULL REFERENCES auth.users(id),
  reason TEXT,
  status public.access_request_status NOT NULL DEFAULT 'pending',
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ,
  responded_by UUID REFERENCES auth.users(id),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_aar_company ON public.accountant_access_requests(company_id);
GRANT SELECT, INSERT, UPDATE ON public.accountant_access_requests TO authenticated;
GRANT ALL ON public.accountant_access_requests TO service_role;
ALTER TABLE public.accountant_access_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view access requests" ON public.accountant_access_requests
  FOR SELECT TO authenticated USING (public.is_company_member(company_id, auth.uid()));
CREATE POLICY "Accountant creates own requests" ON public.accountant_access_requests
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = accountant_user_id);
CREATE POLICY "Owners/admins respond to requests" ON public.accountant_access_requests
  FOR UPDATE TO authenticated
  USING (public.has_company_any_role(company_id, auth.uid(), ARRAY['owner','admin']::public.app_role[]));

-- AUDIT LOGS
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_company_date ON public.audit_logs(company_id, created_at DESC);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view audit logs" ON public.audit_logs
  FOR SELECT TO authenticated USING (public.is_company_member(company_id, auth.uid()));
CREATE POLICY "Members can insert audit logs" ON public.audit_logs
  FOR INSERT TO authenticated WITH CHECK (public.is_company_member(company_id, auth.uid()) AND auth.uid() = user_id);

-- CLIENTS
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  vat TEXT,
  fiscal_code TEXT,
  email TEXT,
  phone TEXT,
  category TEXT,
  zone TEXT,
  last_order_date DATE,
  total_revenue_ytd NUMERIC(15,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_clients_company ON public.clients(company_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO authenticated;
GRANT ALL ON public.clients TO service_role;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read clients" ON public.clients FOR SELECT TO authenticated
  USING (public.is_company_member(company_id, auth.uid()));
CREATE POLICY "Members write clients" ON public.clients FOR INSERT TO authenticated
  WITH CHECK (public.is_company_member(company_id, auth.uid()));
CREATE POLICY "Members update clients" ON public.clients FOR UPDATE TO authenticated
  USING (public.has_company_any_role(company_id, auth.uid(), ARRAY['owner','admin','accountant']::public.app_role[]));
CREATE POLICY "Members delete clients" ON public.clients FOR DELETE TO authenticated
  USING (public.has_company_any_role(company_id, auth.uid(), ARRAY['owner','admin']::public.app_role[]));
CREATE TRIGGER trg_clients_updated_at BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- TRANSACTIONS
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  type public.transaction_type NOT NULL,
  amount NUMERIC(15,2) NOT NULL,
  category TEXT,
  description TEXT,
  counterpart TEXT,
  date DATE NOT NULL,
  status public.transaction_status NOT NULL DEFAULT 'pending',
  source TEXT,
  source_ref TEXT,
  reconciled BOOLEAN NOT NULL DEFAULT false,
  invoice_id UUID,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_transactions_company_date ON public.transactions(company_id, date DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read transactions" ON public.transactions FOR SELECT TO authenticated
  USING (public.is_company_member(company_id, auth.uid()));
CREATE POLICY "Members insert transactions" ON public.transactions FOR INSERT TO authenticated
  WITH CHECK (public.is_company_member(company_id, auth.uid()));
CREATE POLICY "Members update transactions" ON public.transactions FOR UPDATE TO authenticated
  USING (public.has_company_any_role(company_id, auth.uid(), ARRAY['owner','admin','accountant']::public.app_role[]));
CREATE POLICY "Members delete transactions" ON public.transactions FOR DELETE TO authenticated
  USING (public.has_company_any_role(company_id, auth.uid(), ARRAY['owner','admin']::public.app_role[]));
CREATE TRIGGER trg_transactions_updated_at BEFORE UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- INVOICES
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  direction public.invoice_direction NOT NULL,
  number TEXT,
  counterpart_name TEXT NOT NULL,
  counterpart_vat TEXT,
  amount NUMERIC(15,2) NOT NULL,
  vat_amount NUMERIC(15,2),
  total_amount NUMERIC(15,2) NOT NULL,
  issue_date DATE,
  due_date DATE,
  paid_date DATE,
  status public.invoice_status NOT NULL DEFAULT 'draft',
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  file_url TEXT,
  xml_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_invoices_company_due ON public.invoices(company_id, due_date);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read invoices" ON public.invoices FOR SELECT TO authenticated
  USING (public.is_company_member(company_id, auth.uid()));
CREATE POLICY "Members insert invoices" ON public.invoices FOR INSERT TO authenticated
  WITH CHECK (public.is_company_member(company_id, auth.uid()));
CREATE POLICY "Members update invoices" ON public.invoices FOR UPDATE TO authenticated
  USING (public.has_company_any_role(company_id, auth.uid(), ARRAY['owner','admin','accountant']::public.app_role[]));
CREATE POLICY "Members delete invoices" ON public.invoices FOR DELETE TO authenticated
  USING (public.has_company_any_role(company_id, auth.uid(), ARRAY['owner','admin']::public.app_role[]));
CREATE TRIGGER trg_invoices_updated_at BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- BALANCE SHEETS
CREATE TABLE public.balance_sheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  source_type TEXT,
  raw_file_url TEXT,
  extracted_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  ricavi NUMERIC(15,2),
  ebitda NUMERIC(15,2),
  utile_netto NUMERIC(15,2),
  patrimonio_netto NUMERIC(15,2),
  debiti_totali NUMERIC(15,2),
  liquidita NUMERIC(15,2),
  dipendenti INTEGER,
  confirmed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, year)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.balance_sheets TO authenticated;
GRANT ALL ON public.balance_sheets TO service_role;
ALTER TABLE public.balance_sheets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read bs" ON public.balance_sheets FOR SELECT TO authenticated
  USING (public.is_company_member(company_id, auth.uid()));
CREATE POLICY "Members write bs" ON public.balance_sheets FOR INSERT TO authenticated
  WITH CHECK (public.is_company_member(company_id, auth.uid()));
CREATE POLICY "Members update bs" ON public.balance_sheets FOR UPDATE TO authenticated
  USING (public.has_company_any_role(company_id, auth.uid(), ARRAY['owner','admin','accountant']::public.app_role[]));
CREATE POLICY "Members delete bs" ON public.balance_sheets FOR DELETE TO authenticated
  USING (public.has_company_any_role(company_id, auth.uid(), ARRAY['owner','admin']::public.app_role[]));
CREATE TRIGGER trg_bs_updated_at BEFORE UPDATE ON public.balance_sheets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- LOANS
CREATE TABLE public.loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  lender TEXT,
  initial_amount NUMERIC(15,2) NOT NULL,
  residual NUMERIC(15,2) NOT NULL,
  rate_type public.loan_rate_type NOT NULL DEFAULT 'fisso',
  rate_value NUMERIC(6,4),
  installment NUMERIC(15,2),
  total_installments INTEGER,
  paid_installments INTEGER DEFAULT 0,
  start_date DATE,
  end_date DATE,
  next_due_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.loans TO authenticated;
GRANT ALL ON public.loans TO service_role;
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read loans" ON public.loans FOR SELECT TO authenticated
  USING (public.is_company_member(company_id, auth.uid()));
CREATE POLICY "Members write loans" ON public.loans FOR INSERT TO authenticated
  WITH CHECK (public.is_company_member(company_id, auth.uid()));
CREATE POLICY "Members update loans" ON public.loans FOR UPDATE TO authenticated
  USING (public.has_company_any_role(company_id, auth.uid(), ARRAY['owner','admin','accountant']::public.app_role[]));
CREATE POLICY "Members delete loans" ON public.loans FOR DELETE TO authenticated
  USING (public.has_company_any_role(company_id, auth.uid(), ARRAY['owner','admin']::public.app_role[]));
CREATE TRIGGER trg_loans_updated_at BEFORE UPDATE ON public.loans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- TAX DEADLINES
CREATE TABLE public.tax_deadlines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  description TEXT,
  due_date DATE NOT NULL,
  estimated_amount NUMERIC(15,2),
  actual_amount NUMERIC(15,2),
  confidence public.tax_confidence NOT NULL DEFAULT 'medium',
  status public.tax_status NOT NULL DEFAULT 'upcoming',
  paid_at TIMESTAMPTZ,
  notify_days_before INTEGER NOT NULL DEFAULT 7,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tax_company_due ON public.tax_deadlines(company_id, due_date);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tax_deadlines TO authenticated;
GRANT ALL ON public.tax_deadlines TO service_role;
ALTER TABLE public.tax_deadlines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read tax" ON public.tax_deadlines FOR SELECT TO authenticated
  USING (public.is_company_member(company_id, auth.uid()));
CREATE POLICY "Members write tax" ON public.tax_deadlines FOR INSERT TO authenticated
  WITH CHECK (public.is_company_member(company_id, auth.uid()));
CREATE POLICY "Members update tax" ON public.tax_deadlines FOR UPDATE TO authenticated
  USING (public.has_company_any_role(company_id, auth.uid(), ARRAY['owner','admin','accountant']::public.app_role[]));
CREATE POLICY "Members delete tax" ON public.tax_deadlines FOR DELETE TO authenticated
  USING (public.has_company_any_role(company_id, auth.uid(), ARRAY['owner','admin']::public.app_role[]));
CREATE TRIGGER trg_tax_updated_at BEFORE UPDATE ON public.tax_deadlines
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- SIMULATIONS
CREATE TABLE public.simulations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  parameters JSONB NOT NULL DEFAULT '{}'::jsonb,
  result JSONB NOT NULL DEFAULT '{}'::jsonb,
  status public.simulation_status NOT NULL DEFAULT 'draft',
  promoted_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.simulations TO authenticated;
GRANT ALL ON public.simulations TO service_role;
ALTER TABLE public.simulations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read sims" ON public.simulations FOR SELECT TO authenticated
  USING (public.is_company_member(company_id, auth.uid()));
CREATE POLICY "Members write sims" ON public.simulations FOR INSERT TO authenticated
  WITH CHECK (public.is_company_member(company_id, auth.uid()));
CREATE POLICY "Members update sims" ON public.simulations FOR UPDATE TO authenticated
  USING (public.is_company_member(company_id, auth.uid()));
CREATE POLICY "Members delete sims" ON public.simulations FOR DELETE TO authenticated
  USING (public.has_company_any_role(company_id, auth.uid(), ARRAY['owner','admin']::public.app_role[]));
CREATE TRIGGER trg_sims_updated_at BEFORE UPDATE ON public.simulations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- UTILITY BILLS
CREATE TABLE public.utility_bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  supplier TEXT,
  period_start DATE,
  period_end DATE,
  consumption NUMERIC(15,4),
  unit TEXT,
  unit_price NUMERIC(15,6),
  fixed_costs NUMERIC(15,2),
  total_amount NUMERIC(15,2),
  file_url TEXT,
  extracted_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.utility_bills TO authenticated;
GRANT ALL ON public.utility_bills TO service_role;
ALTER TABLE public.utility_bills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read bills" ON public.utility_bills FOR SELECT TO authenticated
  USING (public.is_company_member(company_id, auth.uid()));
CREATE POLICY "Members write bills" ON public.utility_bills FOR INSERT TO authenticated
  WITH CHECK (public.is_company_member(company_id, auth.uid()));
CREATE POLICY "Members update bills" ON public.utility_bills FOR UPDATE TO authenticated
  USING (public.is_company_member(company_id, auth.uid()));
CREATE POLICY "Members delete bills" ON public.utility_bills FOR DELETE TO authenticated
  USING (public.has_company_any_role(company_id, auth.uid(), ARRAY['owner','admin']::public.app_role[]));
CREATE TRIGGER trg_bills_updated_at BEFORE UPDATE ON public.utility_bills
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- COST SAVINGS
CREATE TABLE public.cost_savings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  estimated_saving_annual NUMERIC(15,2),
  confidence public.tax_confidence NOT NULL DEFAULT 'medium',
  status public.opportunity_status NOT NULL DEFAULT 'new',
  simulation_id UUID REFERENCES public.simulations(id) ON DELETE SET NULL,
  source_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cost_savings TO authenticated;
GRANT ALL ON public.cost_savings TO service_role;
ALTER TABLE public.cost_savings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read savings" ON public.cost_savings FOR SELECT TO authenticated
  USING (public.is_company_member(company_id, auth.uid()));
CREATE POLICY "Members write savings" ON public.cost_savings FOR INSERT TO authenticated
  WITH CHECK (public.is_company_member(company_id, auth.uid()));
CREATE POLICY "Members update savings" ON public.cost_savings FOR UPDATE TO authenticated
  USING (public.is_company_member(company_id, auth.uid()));
CREATE POLICY "Members delete savings" ON public.cost_savings FOR DELETE TO authenticated
  USING (public.has_company_any_role(company_id, auth.uid(), ARRAY['owner','admin']::public.app_role[]));
CREATE TRIGGER trg_savings_updated_at BEFORE UPDATE ON public.cost_savings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- GRANTS (global catalog - readable to all authenticated)
CREATE TABLE public.grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  source TEXT,
  type public.grant_type,
  description TEXT,
  max_amount NUMERIC(15,2),
  max_percentage NUMERIC(5,2),
  deadline DATE,
  requirements JSONB NOT NULL DEFAULT '{}'::jsonb,
  sectors JSONB NOT NULL DEFAULT '[]'::jsonb,
  min_employees INTEGER,
  max_employees INTEGER,
  min_revenue NUMERIC(15,2),
  max_revenue NUMERIC(15,2),
  required_certifications JSONB NOT NULL DEFAULT '[]'::jsonb,
  regions JSONB NOT NULL DEFAULT '[]'::jsonb,
  company_types JSONB NOT NULL DEFAULT '[]'::jsonb,
  url TEXT,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT now(),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.grants TO authenticated;
GRANT ALL ON public.grants TO service_role;
ALTER TABLE public.grants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read grants" ON public.grants
  FOR SELECT TO authenticated USING (active = true);

-- COMPANY_GRANTS (eligibility per company)
CREATE TABLE public.company_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  grant_id UUID NOT NULL REFERENCES public.grants(id) ON DELETE CASCADE,
  eligibility_score NUMERIC(5,2),
  eligibility_verdict TEXT,
  eligibility_notes TEXT,
  status public.opportunity_status NOT NULL DEFAULT 'new',
  saved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, grant_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_grants TO authenticated;
GRANT ALL ON public.company_grants TO service_role;
ALTER TABLE public.company_grants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read cg" ON public.company_grants FOR SELECT TO authenticated
  USING (public.is_company_member(company_id, auth.uid()));
CREATE POLICY "Members write cg" ON public.company_grants FOR INSERT TO authenticated
  WITH CHECK (public.is_company_member(company_id, auth.uid()));
CREATE POLICY "Members update cg" ON public.company_grants FOR UPDATE TO authenticated
  USING (public.is_company_member(company_id, auth.uid()));
CREATE POLICY "Members delete cg" ON public.company_grants FOR DELETE TO authenticated
  USING (public.has_company_any_role(company_id, auth.uid(), ARRAY['owner','admin']::public.app_role[]));
CREATE TRIGGER trg_cg_updated_at BEFORE UPDATE ON public.company_grants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- CONTRACTS
CREATE TABLE public.contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  supplier_name TEXT NOT NULL,
  type TEXT,
  cost_category TEXT,
  start_date DATE,
  end_date DATE,
  auto_renewal BOOLEAN NOT NULL DEFAULT false,
  notice_days INTEGER,
  monthly_value NUMERIC(15,2),
  annual_value NUMERIC(15,2),
  payment_terms TEXT,
  notes TEXT,
  file_url TEXT,
  extracted_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  status public.contract_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_contracts_company_end ON public.contracts(company_id, end_date);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contracts TO authenticated;
GRANT ALL ON public.contracts TO service_role;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read contracts" ON public.contracts FOR SELECT TO authenticated
  USING (public.is_company_member(company_id, auth.uid()));
CREATE POLICY "Members write contracts" ON public.contracts FOR INSERT TO authenticated
  WITH CHECK (public.is_company_member(company_id, auth.uid()));
CREATE POLICY "Members update contracts" ON public.contracts FOR UPDATE TO authenticated
  USING (public.has_company_any_role(company_id, auth.uid(), ARRAY['owner','admin']::public.app_role[]));
CREATE POLICY "Members delete contracts" ON public.contracts FOR DELETE TO authenticated
  USING (public.has_company_any_role(company_id, auth.uid(), ARRAY['owner','admin']::public.app_role[]));
CREATE TRIGGER trg_contracts_updated_at BEFORE UPDATE ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- SUPPLIER QUOTES
CREATE TABLE public.supplier_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  contract_id UUID REFERENCES public.contracts(id) ON DELETE SET NULL,
  comparison_group UUID NOT NULL DEFAULT gen_random_uuid(),
  supplier_name TEXT NOT NULL,
  total_price NUMERIC(15,2),
  duration_months INTEGER,
  payment_terms TEXT,
  file_url TEXT,
  extracted_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  ai_comparison JSONB NOT NULL DEFAULT '{}'::jsonb,
  recommended BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_quotes TO authenticated;
GRANT ALL ON public.supplier_quotes TO service_role;
ALTER TABLE public.supplier_quotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read sq" ON public.supplier_quotes FOR SELECT TO authenticated
  USING (public.is_company_member(company_id, auth.uid()));
CREATE POLICY "Members write sq" ON public.supplier_quotes FOR INSERT TO authenticated
  WITH CHECK (public.is_company_member(company_id, auth.uid()));
CREATE POLICY "Members update sq" ON public.supplier_quotes FOR UPDATE TO authenticated
  USING (public.is_company_member(company_id, auth.uid()));
CREATE POLICY "Members delete sq" ON public.supplier_quotes FOR DELETE TO authenticated
  USING (public.has_company_any_role(company_id, auth.uid(), ARRAY['owner','admin']::public.app_role[]));

-- AI DIAGNOSES
CREATE TABLE public.ai_diagnoses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  severity public.diagnosis_severity NOT NULL DEFAULT 'info',
  title TEXT NOT NULL,
  description TEXT,
  action_plan JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'active',
  dismissed_at TIMESTAMPTZ,
  snoozed_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_diagnoses TO authenticated;
GRANT ALL ON public.ai_diagnoses TO service_role;
ALTER TABLE public.ai_diagnoses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read diag" ON public.ai_diagnoses FOR SELECT TO authenticated
  USING (public.is_company_member(company_id, auth.uid()));
CREATE POLICY "Members write diag" ON public.ai_diagnoses FOR INSERT TO authenticated
  WITH CHECK (public.is_company_member(company_id, auth.uid()));
CREATE POLICY "Members update diag" ON public.ai_diagnoses FOR UPDATE TO authenticated
  USING (public.is_company_member(company_id, auth.uid()));
CREATE POLICY "Members delete diag" ON public.ai_diagnoses FOR DELETE TO authenticated
  USING (public.has_company_any_role(company_id, auth.uid(), ARRAY['owner','admin']::public.app_role[]));

-- AI OPPORTUNITIES
CREATE TABLE public.ai_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  estimated_impact NUMERIC(15,2),
  confidence public.tax_confidence NOT NULL DEFAULT 'medium',
  status public.opportunity_status NOT NULL DEFAULT 'new',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_opportunities TO authenticated;
GRANT ALL ON public.ai_opportunities TO service_role;
ALTER TABLE public.ai_opportunities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read opp" ON public.ai_opportunities FOR SELECT TO authenticated
  USING (public.is_company_member(company_id, auth.uid()));
CREATE POLICY "Members write opp" ON public.ai_opportunities FOR INSERT TO authenticated
  WITH CHECK (public.is_company_member(company_id, auth.uid()));
CREATE POLICY "Members update opp" ON public.ai_opportunities FOR UPDATE TO authenticated
  USING (public.is_company_member(company_id, auth.uid()));
CREATE POLICY "Members delete opp" ON public.ai_opportunities FOR DELETE TO authenticated
  USING (public.has_company_any_role(company_id, auth.uid(), ARRAY['owner','admin']::public.app_role[]));

-- HEALTH SCORES
CREATE TABLE public.health_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  score NUMERIC(5,2) NOT NULL,
  sub_scores JSONB NOT NULL DEFAULT '{}'::jsonb,
  benchmark_sector_avg NUMERIC(5,2),
  credit_score_estimate JSONB NOT NULL DEFAULT '{}'::jsonb,
  period_start DATE,
  period_end DATE,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_hs_company_date ON public.health_scores(company_id, calculated_at DESC);
GRANT SELECT, INSERT ON public.health_scores TO authenticated;
GRANT ALL ON public.health_scores TO service_role;
ALTER TABLE public.health_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read hs" ON public.health_scores FOR SELECT TO authenticated
  USING (public.is_company_member(company_id, auth.uid()));
CREATE POLICY "Members write hs" ON public.health_scores FOR INSERT TO authenticated
  WITH CHECK (public.is_company_member(company_id, auth.uid()));

-- CARBON FOOTPRINT
CREATE TABLE public.carbon_footprint (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  energy_tco2e NUMERIC(15,4) DEFAULT 0,
  fleet_tco2e NUMERIC(15,4) DEFAULT 0,
  scope3_tco2e NUMERIC(15,4) DEFAULT 0,
  total_tco2e NUMERIC(15,4) DEFAULT 0,
  source_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.carbon_footprint TO authenticated;
GRANT ALL ON public.carbon_footprint TO service_role;
ALTER TABLE public.carbon_footprint ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read cf" ON public.carbon_footprint FOR SELECT TO authenticated
  USING (public.is_company_member(company_id, auth.uid()));
CREATE POLICY "Members write cf" ON public.carbon_footprint FOR INSERT TO authenticated
  WITH CHECK (public.is_company_member(company_id, auth.uid()));
CREATE POLICY "Members update cf" ON public.carbon_footprint FOR UPDATE TO authenticated
  USING (public.is_company_member(company_id, auth.uid()));
CREATE POLICY "Members delete cf" ON public.carbon_footprint FOR DELETE TO authenticated
  USING (public.has_company_any_role(company_id, auth.uid(), ARRAY['owner','admin']::public.app_role[]));

-- NOTIFICATIONS
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  read BOOLEAN NOT NULL DEFAULT false,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notif_user ON public.notifications(user_id, read, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own notifications" ON public.notifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users update own notifications" ON public.notifications
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Service inserts notifications" ON public.notifications
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- EVENTS TIMELINE
CREATE TABLE public.events_timeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  amount NUMERIC(15,2),
  event_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_events_company_date ON public.events_timeline(company_id, event_date DESC);
GRANT SELECT, INSERT ON public.events_timeline TO authenticated;
GRANT ALL ON public.events_timeline TO service_role;
ALTER TABLE public.events_timeline ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read events" ON public.events_timeline FOR SELECT TO authenticated
  USING (public.is_company_member(company_id, auth.uid()));
CREATE POLICY "Members write events" ON public.events_timeline FOR INSERT TO authenticated
  WITH CHECK (public.is_company_member(company_id, auth.uid()));

-- DASHBOARD LAYOUTS (per user per company)
CREATE TABLE public.dashboard_layouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Default',
  is_default BOOLEAN NOT NULL DEFAULT true,
  layout JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, company_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dashboard_layouts TO authenticated;
GRANT ALL ON public.dashboard_layouts TO service_role;
ALTER TABLE public.dashboard_layouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "User read own layouts" ON public.dashboard_layouts FOR SELECT TO authenticated
  USING (auth.uid() = user_id AND public.is_company_member(company_id, auth.uid()));
CREATE POLICY "User write own layouts" ON public.dashboard_layouts FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.is_company_member(company_id, auth.uid()));
CREATE POLICY "User update own layouts" ON public.dashboard_layouts FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "User delete own layouts" ON public.dashboard_layouts FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
CREATE TRIGGER trg_dl_updated_at BEFORE UPDATE ON public.dashboard_layouts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
