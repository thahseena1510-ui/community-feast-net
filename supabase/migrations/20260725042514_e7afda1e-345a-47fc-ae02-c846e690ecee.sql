GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_verified_ngo(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_donation_counterparty(uuid, uuid) TO authenticated;