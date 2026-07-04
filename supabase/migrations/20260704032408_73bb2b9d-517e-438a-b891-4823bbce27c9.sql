
CREATE OR REPLACE FUNCTION public.is_verified_ngo(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = _uid AND ngo_verified = true)
$$;

CREATE OR REPLACE FUNCTION public.is_donation_counterparty(_profile_id uuid, _viewer uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.donations d
    WHERE (d.donor_id = _profile_id AND d.accepted_by_ngo_id = _viewer)
       OR (d.accepted_by_ngo_id = _profile_id AND d.donor_id = _viewer)
  )
$$;

DROP POLICY IF EXISTS "Verified NGO views available donations" ON public.donations;
CREATE POLICY "Verified NGO views available donations" ON public.donations
FOR SELECT USING (
  status = 'pending'::donation_status
  AND has_role(auth.uid(), 'ngo'::app_role)
  AND public.is_verified_ngo(auth.uid())
);

DROP POLICY IF EXISTS "Verified NGO accepts pending donation" ON public.donations;
CREATE POLICY "Verified NGO accepts pending donation" ON public.donations
FOR UPDATE USING (
  ((status = 'pending'::donation_status)
   AND has_role(auth.uid(), 'ngo'::app_role)
   AND public.is_verified_ngo(auth.uid()))
  OR (accepted_by_ngo_id = auth.uid())
) WITH CHECK (accepted_by_ngo_id = auth.uid());

DROP POLICY IF EXISTS "View counterparty profile via donation" ON public.profiles;
CREATE POLICY "View counterparty profile via donation" ON public.profiles
FOR SELECT USING (public.is_donation_counterparty(profiles.id, auth.uid()));
