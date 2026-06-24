
REVOKE EXECUTE ON FUNCTION public.is_demo_user() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.increment_ai_extractions() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_demo_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_ai_extractions() TO authenticated;
