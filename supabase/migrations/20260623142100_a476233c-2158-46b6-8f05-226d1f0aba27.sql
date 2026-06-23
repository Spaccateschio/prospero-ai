
REVOKE EXECUTE ON FUNCTION public.get_user_company_ids(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_company_member(UUID, UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_company_role(UUID, UUID, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_company_any_role(UUID, UUID, public.app_role[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon;
