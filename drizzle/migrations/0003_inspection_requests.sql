CREATE TABLE public.inspection_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id text NOT NULL,
  client_user_id uuid NOT NULL DEFAULT auth.uid(),
  client_email text NOT NULL DEFAULT '',
  client_label text NOT NULL DEFAULT '',
  agent_email text,
  property_id text,
  property_label text NOT NULL DEFAULT '',
  state text NOT NULL,
  property_category text NOT NULL DEFAULT 'house',
  inspection_types text[] NOT NULL DEFAULT '{}',
  deadline_days integer,
  agreement_signed_at timestamptz,
  status text NOT NULL DEFAULT 'open',
  inspector_request_id uuid,
  inspector_user_id uuid,
  inspector_company text,
  inspector_contact jsonb,
  fee numeric,
  proposed_at timestamptz,
  scheduled_at timestamptz,
  report_files jsonb NOT NULL DEFAULT '[]'::jsonb,
  history jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX inspection_requests_one_active ON public.inspection_requests (lead_id) WHERE status <> 'cancelled';

GRANT SELECT, INSERT, UPDATE ON public.inspection_requests TO authenticated;
GRANT ALL ON public.inspection_requests TO service_role;
ALTER TABLE public.inspection_requests ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.inspector_covers(_state text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.partner_requests pr
    WHERE pr.user_id = auth.uid() AND pr.status = 'approved' AND pr.partner_type = 'inspector'
      AND (pr.all_states OR _state = ANY(pr.states) OR EXISTS (
        SELECT 1 FROM jsonb_array_elements(coalesce(pr.inspector_profile->'coverage','[]'::jsonb)) c
        WHERE c->>'state' = _state))
  )
$$;

CREATE POLICY "Clients, matching inspectors and admins read inspection requests"
ON public.inspection_requests FOR SELECT TO authenticated
USING (client_user_id = auth.uid() OR inspector_user_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR (status = 'open' AND public.inspector_covers(state)));

CREATE POLICY "Clients create their own inspection request"
ON public.inspection_requests FOR INSERT TO authenticated
WITH CHECK (client_user_id = auth.uid() AND status = 'open' AND inspector_user_id IS NULL);

CREATE POLICY "Client, assigned inspector or admin update"
ON public.inspection_requests FOR UPDATE TO authenticated
USING (client_user_id = auth.uid() OR inspector_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (client_user_id = auth.uid() OR inspector_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER inspection_requests_updated_at BEFORE UPDATE ON public.inspection_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.accept_inspection_request(_id uuid, _fee numeric, _proposed_at timestamptz, _contact jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.inspection_requests; pr public.partner_requests;
BEGIN
  SELECT * INTO r FROM public.inspection_requests WHERE id = _id FOR UPDATE;
  IF r.id IS NULL OR r.status <> 'open' THEN RAISE EXCEPTION 'This request is no longer open'; END IF;
  IF NOT public.inspector_covers(r.state) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  SELECT * INTO pr FROM public.partner_requests WHERE user_id = auth.uid() AND status = 'approved' AND partner_type = 'inspector' LIMIT 1;
  UPDATE public.inspection_requests SET
    status = 'accepted', inspector_request_id = pr.id, inspector_user_id = auth.uid(),
    inspector_company = coalesce(nullif(pr.inspector_profile->>'legalName',''), pr.company_name),
    inspector_contact = _contact, fee = _fee, proposed_at = _proposed_at,
    history = history || jsonb_build_array(jsonb_build_object('status','accepted','at',now(),'by',coalesce(nullif(pr.inspector_profile->>'legalName',''), pr.company_name)))
  WHERE id = _id;
END; $$;
REVOKE EXECUTE ON FUNCTION public.accept_inspection_request(uuid, numeric, timestamptz, jsonb) FROM anon;

CREATE POLICY "Inspection report read" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'inspection-reports' AND EXISTS (SELECT 1 FROM public.inspection_requests ir WHERE ir.id::text = (storage.foldername(name))[1]));
CREATE POLICY "Inspection report upload" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'inspection-reports' AND EXISTS (SELECT 1 FROM public.inspection_requests ir WHERE ir.id::text = (storage.foldername(name))[1] AND (ir.inspector_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))));