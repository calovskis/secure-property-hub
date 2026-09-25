ALTER POLICY "Clients read own entity request, admins all" ON public.entity_setup_requests
  USING (auth.uid() = user_id OR private.has_role(auth.uid(), 'admin'::public.app_role));
ALTER POLICY "Admins update entity requests" ON public.entity_setup_requests
  USING (private.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));
ALTER POLICY "Clients read own visa request, admins all" ON public.visa_support_requests
  USING (auth.uid() = user_id OR private.has_role(auth.uid(), 'admin'::public.app_role));
ALTER POLICY "Admins update visa requests" ON public.visa_support_requests
  USING (private.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));
ALTER POLICY "Admins can update deletion records" ON public.profile_deletions
  USING (private.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));
ALTER POLICY "Users can request their own deletion, admins anyone's" ON public.profile_deletions
  WITH CHECK (lower(email) = lower(COALESCE(auth.jwt() ->> 'email', '')) OR private.has_role(auth.uid(), 'admin'::public.app_role));