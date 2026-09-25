CREATE TABLE public.visa_support_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  email text NOT NULL,
  client_name text NOT NULL DEFAULT '',
  citizenship text,
  country_of_residence text,
  status text NOT NULL DEFAULT 'requested',
  status_note text,
  history jsonb NOT NULL DEFAULT '[]'::jsonb,
  requested_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.visa_support_requests TO authenticated;
GRANT ALL ON public.visa_support_requests TO service_role;
ALTER TABLE public.visa_support_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clients read own visa request, admins all" ON public.visa_support_requests FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Clients create own visa request" ON public.visa_support_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND status = 'requested');
CREATE POLICY "Admins update visa requests" ON public.visa_support_requests FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER update_visa_support_requests_updated_at BEFORE UPDATE ON public.visa_support_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();