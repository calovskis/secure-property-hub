CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
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

REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role;

ALTER POLICY "Admins can read the admin list" ON public.admin_emails
USING (private.has_role(auth.uid(), 'admin'::public.app_role));
ALTER POLICY "Clients can read their own registration profile" ON public.client_profiles
USING (auth.uid() = user_id OR private.has_role(auth.uid(), 'admin'::public.app_role));
ALTER POLICY "Clients can update their own registration profile" ON public.client_profiles
USING (auth.uid() = user_id OR private.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (auth.uid() = user_id OR private.has_role(auth.uid(), 'admin'::public.app_role));
ALTER POLICY "Partners can read their own registration" ON public.partner_requests
USING (auth.uid() = user_id OR private.has_role(auth.uid(), 'admin'::public.app_role));
ALTER POLICY "Partners can update their own registration" ON public.partner_requests
USING (auth.uid() = user_id OR private.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (auth.uid() = user_id OR private.has_role(auth.uid(), 'admin'::public.app_role));
ALTER POLICY "Users can read their own roles" ON public.user_roles
USING (auth.uid() = user_id OR private.has_role(auth.uid(), 'admin'::public.app_role));
ALTER POLICY "Partner document owners and admins can read" ON storage.objects
USING (bucket_id = 'partner-documents' AND (auth.uid()::text = (storage.foldername(name))[1] OR private.has_role(auth.uid(), 'admin'::public.app_role)));

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role, postgres;