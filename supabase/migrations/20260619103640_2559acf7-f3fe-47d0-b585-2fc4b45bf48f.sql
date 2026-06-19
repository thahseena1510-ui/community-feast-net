
-- ENUMS
CREATE TYPE public.app_role AS ENUM ('donor', 'ngo', 'admin');
CREATE TYPE public.donation_status AS ENUM ('pending', 'accepted', 'picked_up', 'delivered', 'cancelled');

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  address TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  ngo_name TEXT,
  ngo_verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- USER_ROLES
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- has_role security definer
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- DONATIONS
CREATE TABLE public.donations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  donor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  food_name TEXT NOT NULL,
  description TEXT,
  quantity TEXT NOT NULL,
  image_url TEXT,
  pickup_address TEXT NOT NULL,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  expiry_time TIMESTAMPTZ NOT NULL,
  status donation_status NOT NULL DEFAULT 'pending',
  accepted_by_ngo_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  accepted_at TIMESTAMPTZ,
  picked_up_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.donations TO authenticated;
GRANT ALL ON public.donations TO service_role;
ALTER TABLE public.donations ENABLE ROW LEVEL SECURITY;

CREATE INDEX donations_status_idx ON public.donations(status);
CREATE INDEX donations_donor_idx ON public.donations(donor_id);
CREATE INDEX donations_ngo_idx ON public.donations(accepted_by_ngo_id);

-- NOTIFICATIONS
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  donation_id UUID REFERENCES public.donations(id) ON DELETE CASCADE,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE INDEX notifications_user_idx ON public.notifications(user_id, read);

-- POLICIES: profiles
CREATE POLICY "View own profile" ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "View counterparty profile via donation" ON public.profiles FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.donations d
      WHERE (d.donor_id = profiles.id AND d.accepted_by_ngo_id = auth.uid())
         OR (d.accepted_by_ngo_id = profiles.id AND d.donor_id = auth.uid())
    )
  );
CREATE POLICY "NGOs viewable to all authenticated" ON public.profiles FOR SELECT TO authenticated
  USING (ngo_name IS NOT NULL);
CREATE POLICY "Insert own profile" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);
CREATE POLICY "Update own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Admin update any profile" ON public.profiles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- POLICIES: user_roles
CREATE POLICY "View own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- POLICIES: donations
CREATE POLICY "Donor views own donations" ON public.donations FOR SELECT TO authenticated
  USING (donor_id = auth.uid());
CREATE POLICY "Verified NGO views available donations" ON public.donations FOR SELECT TO authenticated
  USING (
    status = 'pending'
    AND public.has_role(auth.uid(), 'ngo')
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.ngo_verified = true)
  );
CREATE POLICY "NGO views accepted donations" ON public.donations FOR SELECT TO authenticated
  USING (accepted_by_ngo_id = auth.uid());
CREATE POLICY "Admin views all donations" ON public.donations FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Donor inserts own donation" ON public.donations FOR INSERT TO authenticated
  WITH CHECK (donor_id = auth.uid() AND public.has_role(auth.uid(), 'donor'));
CREATE POLICY "Donor updates own pending donation" ON public.donations FOR UPDATE TO authenticated
  USING (donor_id = auth.uid())
  WITH CHECK (donor_id = auth.uid());
CREATE POLICY "Verified NGO accepts pending donation" ON public.donations FOR UPDATE TO authenticated
  USING (
    (status = 'pending' AND public.has_role(auth.uid(), 'ngo')
     AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.ngo_verified = true))
    OR accepted_by_ngo_id = auth.uid()
  )
  WITH CHECK (accepted_by_ngo_id = auth.uid());
CREATE POLICY "Admin updates donations" ON public.donations FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Donor deletes own pending donation" ON public.donations FOR DELETE TO authenticated
  USING (donor_id = auth.uid() AND status = 'pending');
CREATE POLICY "Admin deletes any donation" ON public.donations FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- POLICIES: notifications
CREATE POLICY "User views own notifications" ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "User updates own notifications" ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "User deletes own notifications" ON public.notifications FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- updated_at trigger function
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER profiles_set_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER donations_set_updated BEFORE UPDATE ON public.donations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- On new auth user: create profile + default donor role (role can be changed at signup via the app updating user_roles)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role app_role;
  v_role_text TEXT;
  v_full_name TEXT;
  v_ngo_name TEXT;
BEGIN
  v_role_text := COALESCE(NEW.raw_user_meta_data->>'role', 'donor');
  IF v_role_text NOT IN ('donor','ngo') THEN v_role_text := 'donor'; END IF;
  v_role := v_role_text::app_role;
  v_full_name := NEW.raw_user_meta_data->>'full_name';
  v_ngo_name := NEW.raw_user_meta_data->>'ngo_name';

  INSERT INTO public.profiles (id, full_name, ngo_name) VALUES (NEW.id, v_full_name, v_ngo_name);
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, v_role);
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Notify donor when accepted / status updates
CREATE OR REPLACE FUNCTION public.notify_donation_status()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status <> OLD.status THEN
    INSERT INTO public.notifications (user_id, type, title, body, donation_id)
    VALUES (
      NEW.donor_id,
      'status_change',
      CASE NEW.status
        WHEN 'accepted' THEN 'Your donation was accepted'
        WHEN 'picked_up' THEN 'Your donation was picked up'
        WHEN 'delivered' THEN 'Your donation was delivered'
        WHEN 'cancelled' THEN 'Your donation was cancelled'
        ELSE 'Donation status updated'
      END,
      'Food: ' || NEW.food_name,
      NEW.id
    );
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER donations_notify_status
  AFTER UPDATE ON public.donations
  FOR EACH ROW EXECUTE FUNCTION public.notify_donation_status();

-- Notify all verified NGOs when a new donation is posted
CREATE OR REPLACE FUNCTION public.notify_ngos_new_donation()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, body, donation_id)
  SELECT ur.user_id, 'new_donation', 'New donation available', NEW.food_name || ' — ' || NEW.pickup_address, NEW.id
  FROM public.user_roles ur
  JOIN public.profiles p ON p.id = ur.user_id
  WHERE ur.role = 'ngo' AND p.ngo_verified = true;
  RETURN NEW;
END; $$;

CREATE TRIGGER donations_notify_new
  AFTER INSERT ON public.donations
  FOR EACH ROW EXECUTE FUNCTION public.notify_ngos_new_donation();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.donations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
