CREATE OR REPLACE FUNCTION public.get_platform_stats()
RETURNS TABLE(total_donations bigint, delivered bigint, active_ngos bigint, in_progress bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (SELECT count(*) FROM public.donations),
    (SELECT count(*) FROM public.donations WHERE status = 'delivered'),
    (SELECT count(*) FROM public.profiles WHERE ngo_verified = true),
    (SELECT count(*) FROM public.donations WHERE status IN ('accepted','picked_up'));
$$;

GRANT EXECUTE ON FUNCTION public.get_platform_stats() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_donation_trends(days integer DEFAULT 30)
RETURNS TABLE(day date, posted bigint, delivered bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH series AS (
    SELECT generate_series(
      (current_date - (days - 1))::date,
      current_date,
      interval '1 day'
    )::date AS day
  )
  SELECT
    s.day,
    COALESCE(SUM(CASE WHEN d.created_at::date = s.day THEN 1 ELSE 0 END), 0) AS posted,
    COALESCE(SUM(CASE WHEN d.delivered_at::date = s.day THEN 1 ELSE 0 END), 0) AS delivered
  FROM series s
  LEFT JOIN public.donations d
    ON d.created_at::date = s.day OR d.delivered_at::date = s.day
  GROUP BY s.day
  ORDER BY s.day;
$$;

GRANT EXECUTE ON FUNCTION public.get_donation_trends(integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_status_breakdown()
RETURNS TABLE(status text, count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT status::text, count(*)::bigint
  FROM public.donations
  GROUP BY status;
$$;

GRANT EXECUTE ON FUNCTION public.get_status_breakdown() TO authenticated;
