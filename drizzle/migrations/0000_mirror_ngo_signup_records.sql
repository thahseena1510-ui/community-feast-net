CREATE TABLE public.ngos (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  ngo_name text NOT NULL,
  contact_name text,
  phone text,
  address text,
  lat double precision,
  lng double precision,
  ngo_verified boolean NOT NULL DEFAULT false,
  ngo_doc_path text,
  ngo_doc_uploaded_at timestamptz,
  ngo_doc_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ngos TO authenticated;
GRANT ALL ON public.ngos TO service_role;
ALTER TABLE public.ngos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "NGO views own organization record" ON public.ngos
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admin views all NGO organization records" ON public.ngos
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));

INSERT INTO public.ngos (user_id, ngo_name, contact_name, phone, address, lat, lng, ngo_verified, ngo_doc_path, ngo_doc_uploaded_at, ngo_doc_note, created_at, updated_at)
SELECT p.id, p.ngo_name, p.full_name, p.phone, p.address, p.lat, p.lng, p.ngo_verified, p.ngo_doc_path, p.ngo_doc_uploaded_at, p.ngo_doc_note, p.created_at, p.updated_at
FROM public.profiles p
JOIN public.user_roles ur ON ur.user_id = p.id AND ur.role = 'ngo'::public.app_role
WHERE p.ngo_name IS NOT NULL AND btrim(p.ngo_name) <> ''
ON CONFLICT (user_id) DO UPDATE SET
  ngo_name = EXCLUDED.ngo_name,
  contact_name = EXCLUDED.contact_name,
  phone = EXCLUDED.phone,
  address = EXCLUDED.address,
  lat = EXCLUDED.lat,
  lng = EXCLUDED.lng,
  ngo_verified = EXCLUDED.ngo_verified,
  ngo_doc_path = EXCLUDED.ngo_doc_path,
  ngo_doc_uploaded_at = EXCLUDED.ngo_doc_uploaded_at,
  ngo_doc_note = EXCLUDED.ngo_doc_note,
  updated_at = EXCLUDED.updated_at;

CREATE OR REPLACE FUNCTION public.sync_ngo_from_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(NEW.id, 'ngo'::public.app_role)
     AND NEW.ngo_name IS NOT NULL
     AND btrim(NEW.ngo_name) <> '' THEN
    INSERT INTO public.ngos (user_id, ngo_name, contact_name, phone, address, lat, lng, ngo_verified, ngo_doc_path, ngo_doc_uploaded_at, ngo_doc_note, created_at, updated_at)
    VALUES (NEW.id, NEW.ngo_name, NEW.full_name, NEW.phone, NEW.address, NEW.lat, NEW.lng, NEW.ngo_verified, NEW.ngo_doc_path, NEW.ngo_doc_uploaded_at, NEW.ngo_doc_note, NEW.created_at, NEW.updated_at)
    ON CONFLICT (user_id) DO UPDATE SET
      ngo_name = EXCLUDED.ngo_name,
      contact_name = EXCLUDED.contact_name,
      phone = EXCLUDED.phone,
      address = EXCLUDED.address,
      lat = EXCLUDED.lat,
      lng = EXCLUDED.lng,
      ngo_verified = EXCLUDED.ngo_verified,
      ngo_doc_path = EXCLUDED.ngo_doc_path,
      ngo_doc_uploaded_at = EXCLUDED.ngo_doc_uploaded_at,
      ngo_doc_note = EXCLUDED.ngo_doc_note,
      updated_at = EXCLUDED.updated_at;
  ELSE
    DELETE FROM public.ngos WHERE user_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.sync_ngo_from_profile() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER profiles_sync_ngo_record
  AFTER INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.sync_ngo_from_profile();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role public.app_role;
  v_role_text text;
  v_full_name text;
  v_ngo_name text;
BEGIN
  v_role_text := COALESCE(NEW.raw_user_meta_data->>'role', 'donor');
  IF v_role_text NOT IN ('donor', 'ngo') THEN
    v_role_text := 'donor';
  END IF;
  v_role := v_role_text::public.app_role;
  v_full_name := NEW.raw_user_meta_data->>'full_name';
  v_ngo_name := NEW.raw_user_meta_data->>'ngo_name';

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, v_role);
  INSERT INTO public.profiles (id, full_name, ngo_name) VALUES (NEW.id, v_full_name, v_ngo_name);
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO supabase_auth_admin, postgres, service_role;