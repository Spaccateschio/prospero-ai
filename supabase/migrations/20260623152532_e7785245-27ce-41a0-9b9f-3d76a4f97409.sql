
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO postgres, service_role, authenticated;

CREATE OR REPLACE FUNCTION private.is_company_member(_company_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.company_users WHERE company_id = _company_id AND user_id = _user_id); $$;

CREATE OR REPLACE FUNCTION private.has_company_role(_company_id uuid, _user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.company_users WHERE company_id = _company_id AND user_id = _user_id AND role = _role); $$;

CREATE OR REPLACE FUNCTION private.has_company_any_role(_company_id uuid, _user_id uuid, _roles public.app_role[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.company_users WHERE company_id = _company_id AND user_id = _user_id AND role = ANY(_roles)); $$;

CREATE OR REPLACE FUNCTION private.get_user_company_ids(_user_id uuid)
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT company_id FROM public.company_users WHERE user_id = _user_id; $$;

REVOKE ALL ON FUNCTION private.is_company_member(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.has_company_role(uuid, uuid, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.has_company_any_role(uuid, uuid, public.app_role[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.get_user_company_ids(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.is_company_member(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.has_company_role(uuid, uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.has_company_any_role(uuid, uuid, public.app_role[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.get_user_company_ids(uuid) TO authenticated, service_role;

DO $rewrite$
DECLARE
  r record;
  new_qual text;
  new_check text;
  roles_csv text;
  using_clause text;
  check_clause text;
  permissive_clause text;
  helper_pat text := '(is_company_member|has_company_role|has_company_any_role|get_user_company_ids)';
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (COALESCE(qual,'') ~ helper_pat OR COALESCE(with_check,'') ~ helper_pat)
  LOOP
    new_qual := r.qual;
    new_check := r.with_check;

    IF new_qual IS NOT NULL THEN
      new_qual := regexp_replace(new_qual, '(^|[^.[:alnum:]_])' || helper_pat || '\s*\(', '\1private.\2(', 'g');
    END IF;
    IF new_check IS NOT NULL THEN
      new_check := regexp_replace(new_check, '(^|[^.[:alnum:]_])' || helper_pat || '\s*\(', '\1private.\2(', 'g');
    END IF;

    roles_csv := array_to_string(ARRAY(SELECT quote_ident(x) FROM unnest(r.roles) x), ', ');
    permissive_clause := CASE WHEN r.permissive = 'PERMISSIVE' THEN 'PERMISSIVE' ELSE 'RESTRICTIVE' END;
    using_clause := CASE WHEN new_qual IS NOT NULL THEN format(' USING (%s)', new_qual) ELSE '' END;
    check_clause := CASE WHEN new_check IS NOT NULL THEN format(' WITH CHECK (%s)', new_check) ELSE '' END;

    EXECUTE format('DROP POLICY %I ON %I.%I;', r.policyname, r.schemaname, r.tablename);
    EXECUTE format(
      'CREATE POLICY %I ON %I.%I AS %s FOR %s TO %s%s%s;',
      r.policyname, r.schemaname, r.tablename,
      permissive_clause, r.cmd, roles_csv, using_clause, check_clause
    );
  END LOOP;
END
$rewrite$;

DROP FUNCTION IF EXISTS public.is_company_member(uuid, uuid);
DROP FUNCTION IF EXISTS public.has_company_role(uuid, uuid, public.app_role);
DROP FUNCTION IF EXISTS public.has_company_any_role(uuid, uuid, public.app_role[]);
DROP FUNCTION IF EXISTS public.get_user_company_ids(uuid);
