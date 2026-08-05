CREATE OR REPLACE FUNCTION public.notify_ngo_verification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.ngo_verified IS DISTINCT FROM OLD.ngo_verified AND NEW.ngo_name IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, body)
    VALUES (
      NEW.id,
      'ngo_verification',
      CASE WHEN NEW.ngo_verified THEN 'Your NGO has been verified' ELSE 'Your NGO verification was revoked' END,
      CASE WHEN NEW.ngo_verified
        THEN 'You can now browse and accept available donations.'
        ELSE 'You can no longer accept new donations. Contact support or complete your profile for re-review.'
      END
    );
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS profiles_notify_verification ON public.profiles;
CREATE TRIGGER profiles_notify_verification
AFTER UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.notify_ngo_verification();

ALTER TABLE public.profiles REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'profiles'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles';
  END IF;
END $$;