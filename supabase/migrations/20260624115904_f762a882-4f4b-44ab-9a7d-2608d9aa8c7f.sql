
-- Restrict deadlines policies to authenticated role
ALTER POLICY "Members read deadlines" ON public.deadlines TO authenticated;
ALTER POLICY "Members write deadlines" ON public.deadlines TO authenticated;
ALTER POLICY "Members update deadlines" ON public.deadlines TO authenticated;
ALTER POLICY "Members delete deadlines" ON public.deadlines TO authenticated;

-- Allow accountants to view their own access requests
CREATE POLICY "Accountants view own requests"
ON public.accountant_access_requests
FOR SELECT
TO authenticated
USING (accountant_user_id = auth.uid());
