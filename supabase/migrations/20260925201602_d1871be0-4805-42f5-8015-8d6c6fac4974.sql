CREATE TABLE public.entity_setup_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  email text NOT NULL,
  client_name text NOT NULL DEFAULT '',
  property_label text,
  lead_id text,
  status text NOT NULL DEFAULT 'requested',
  status_note text,
  history jsonb NOT NULL DEFAULT '[]'::jsonb,
  requested_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);
GRANT SELECT, INSERT, UPDATE ON public.entity_setup_requests TO authenticated;
GRANT ALL ON public.entity_setup_requests TO service_role;
ALTER TABLE public.entity_setup_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clients create own entity request" ON public.entity_setup_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND status = 'requested');
CREATE POLICY "Clients read own entity request, admins all" ON public.entity_setup_requests FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update entity requests" ON public.entity_setup_requests FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER entity_setup_requests_updated_at BEFORE UPDATE ON public.entity_setup_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();