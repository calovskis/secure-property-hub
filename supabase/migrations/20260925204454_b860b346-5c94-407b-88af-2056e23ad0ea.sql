ALTER POLICY "Clients read own case messages, admins all" ON public.case_messages
  USING (auth.uid() = client_user_id OR private.has_role(auth.uid(), 'admin'::public.app_role));
ALTER POLICY "Clients write own case, admins any" ON public.case_messages
  WITH CHECK (author_id = auth.uid() AND ((auth.uid() = client_user_id AND from_loqal = false) OR private.has_role(auth.uid(), 'admin'::public.app_role)));
ALTER POLICY "Clients update own case messages, admins all" ON public.case_messages
  USING (auth.uid() = client_user_id OR private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (auth.uid() = client_user_id OR private.has_role(auth.uid(), 'admin'::public.app_role));