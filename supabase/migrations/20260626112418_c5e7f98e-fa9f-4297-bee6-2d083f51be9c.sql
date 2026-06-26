DROP POLICY IF EXISTS "Members can insert audit logs" ON public.audit_logs;
REVOKE INSERT ON public.audit_logs FROM authenticated;