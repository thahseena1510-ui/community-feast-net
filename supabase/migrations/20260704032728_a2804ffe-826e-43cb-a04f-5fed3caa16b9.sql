
-- 1) Lock down SECURITY DEFINER helpers so only postgres/internal (RLS/trigger) can execute them.
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_verified_ngo(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_donation_counterparty(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_donation_status() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_ngos_new_donation() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_donation_trends(integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_status_breakdown() FROM PUBLIC, anon;
-- Keep get_platform_stats callable by anon (used on public landing page).

-- 2) Restrict NGO profile visibility. Drop the broad policy — admins keep access via
-- "View own profile" (has_role admin), counterparties keep access via
-- "View counterparty profile via donation".
DROP POLICY IF EXISTS "NGOs viewable to all authenticated" ON public.profiles;

-- Provide a safe, name-only lookup for any authenticated user (no phone/address/lat/lng).
CREATE OR REPLACE VIEW public.ngo_directory
WITH (security_invoker = true) AS
SELECT id, ngo_name, ngo_verified
FROM public.profiles
WHERE ngo_name IS NOT NULL;

CREATE POLICY "Authenticated can read NGO name/verified" ON public.profiles
FOR SELECT TO authenticated
USING (
  ngo_name IS NOT NULL
  AND current_setting('request.jwt.claims', true) IS NOT NULL
  AND false  -- direct table read still forbidden; use ngo_directory view
);

GRANT SELECT ON public.ngo_directory TO authenticated;

-- 3) Tighten donation-image storage reads: owner, accepted NGO for that donation, or admin.
DROP POLICY IF EXISTS "Authenticated read donation images" ON storage.objects;

CREATE POLICY "Donation image read scoped to owner, accepted NGO, or admin"
ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'donation-images'
  AND (
    (auth.uid())::text = (storage.foldername(name))[1]
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.donations d
      WHERE d.image_url = storage.objects.name
        AND d.accepted_by_ngo_id = auth.uid()
    )
  )
);
