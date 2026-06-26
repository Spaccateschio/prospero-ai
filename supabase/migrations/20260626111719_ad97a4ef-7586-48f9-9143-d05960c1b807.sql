
-- 1. company_users: prevent privilege escalation
DROP POLICY IF EXISTS "Users can insert themselves as owner when creating company" ON public.company_users;

CREATE POLICY "Creator can self-enroll as owner"
ON public.company_users
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND role = 'owner'::app_role
  AND EXISTS (
    SELECT 1 FROM public.companies c
    WHERE c.id = company_id AND c.created_by = auth.uid()
  )
);

-- 2. events_timeline: add UPDATE/DELETE for owners/admins
CREATE POLICY "Owners and admins can update events"
ON public.events_timeline
FOR UPDATE
TO authenticated
USING (private.has_company_any_role(company_id, auth.uid(), ARRAY['owner'::app_role, 'admin'::app_role]))
WITH CHECK (private.has_company_any_role(company_id, auth.uid(), ARRAY['owner'::app_role, 'admin'::app_role]));

CREATE POLICY "Owners and admins can delete events"
ON public.events_timeline
FOR DELETE
TO authenticated
USING (private.has_company_any_role(company_id, auth.uid(), ARRAY['owner'::app_role, 'admin'::app_role]));

-- 3. health_scores: add UPDATE/DELETE for owners/admins
CREATE POLICY "Owners and admins can update health scores"
ON public.health_scores
FOR UPDATE
TO authenticated
USING (private.has_company_any_role(company_id, auth.uid(), ARRAY['owner'::app_role, 'admin'::app_role]))
WITH CHECK (private.has_company_any_role(company_id, auth.uid(), ARRAY['owner'::app_role, 'admin'::app_role]));

CREATE POLICY "Owners and admins can delete health scores"
ON public.health_scores
FOR DELETE
TO authenticated
USING (private.has_company_any_role(company_id, auth.uid(), ARRAY['owner'::app_role, 'admin'::app_role]));

-- 4. Convert SECURITY DEFINER helpers callable by authenticated users to SECURITY INVOKER.
-- Both only touch the caller's own profiles row, which RLS already permits.
CREATE OR REPLACE FUNCTION public.is_demo_user()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY INVOKER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT is_demo FROM public.profiles WHERE id = auth.uid()), false);
$$;

CREATE OR REPLACE FUNCTION public.increment_ai_extractions()
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  new_count integer;
BEGIN
  UPDATE public.profiles
     SET ai_extractions_used = ai_extractions_used + 1
   WHERE id = auth.uid()
   RETURNING ai_extractions_used INTO new_count;
  RETURN COALESCE(new_count, 0);
END;
$$;
