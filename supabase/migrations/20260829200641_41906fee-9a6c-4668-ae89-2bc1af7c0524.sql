-- Roles ---------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin','lender','realtor','partner','corporate','client');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "Users can read their own roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- Timestamp helper ------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- Partner registrations -------------------------------------------------
CREATE TABLE public.partner_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('partner','corporate')),
  partner_type text,
  company_name text NOT NULL DEFAULT '',
  company_type text NOT NULL DEFAULT '',
  registration_number text NOT NULL DEFAULT '',
  street text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  state text NOT NULL DEFAULT '',
  zip text NOT NULL DEFAULT '',
  country text NOT NULL DEFAULT '',
  first_name text NOT NULL DEFAULT '',
  last_name text NOT NULL DEFAULT '',
  position text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  all_states boolean NOT NULL DEFAULT false,
  states text[] NOT NULL DEFAULT '{}',
  lender_licence text,
  realtor_licenses jsonb NOT NULL DEFAULT '[]'::jsonb,
  languages text[] NOT NULL DEFAULT '{}',
  company_licence text,
  company_phone text,
  tc_accepted_at timestamptz,
  verification_docs text[] NOT NULL DEFAULT '{}',
  kyc jsonb,
  agreement_signed_at timestamptz,
  agreement_signed_by text,
  agreement_countersigned_at timestamptz,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','declined')),
  decided_at timestamptz,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.partner_requests TO authenticated;
GRANT ALL ON public.partner_requests TO service_role;

ALTER TABLE public.partner_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Partners can read their own registration"
  ON public.partner_requests FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Partners can create their own registration"
  ON public.partner_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Partners can update their own registration"
  ON public.partner_requests FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_partner_requests_updated_at
  BEFORE UPDATE ON public.partner_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX partner_requests_status_idx ON public.partner_requests (status);
CREATE INDEX partner_requests_user_idx ON public.partner_requests (user_id);