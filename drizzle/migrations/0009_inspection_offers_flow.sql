ALTER TABLE public.inspection_requests
  ADD COLUMN IF NOT EXISTS offers_due_at timestamptz DEFAULT (now() + interval '48 hours'),
  ADD COLUMN IF NOT EXISTS selected_offer_id uuid,
  ADD COLUMN IF NOT EXISTS agent_selected_at timestamptz,
  ADD COLUMN IF NOT EXISTS agent_note text,
  ADD COLUMN IF NOT EXISTS client_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS invoices jsonb NOT NULL DEFAULT '[]'::jsonb;
UPDATE public.inspection_requests SET offers_due_at = created_at + interval '48 hours' WHERE offers_due_at IS NULL;

CREATE OR REPLACE FUNCTION public.is_inspection_agent(_request_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.inspection_requests r WHERE r.id = _request_id
    AND r.agent_email IS NOT NULL AND lower(r.agent_email) = lower(coalesce(auth.jwt() ->> 'email','')))
$$;

CREATE OR REPLACE FUNCTION public.can_offer_inspection(_request_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.inspection_requests r WHERE r.id = _request_id
    AND (r.inspector_user_id = auth.uid() OR (r.status = 'open' AND public.inspector_covers(r.state))))
$$;

CREATE POLICY "Buyer's agent reads their buyer's inspection requests" ON public.inspection_requests
  FOR SELECT TO authenticated USING (agent_email IS NOT NULL AND lower(agent_email) = lower(coalesce(auth.jwt() ->> 'email','')));

CREATE TABLE public.inspection_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.inspection_requests(id) ON DELETE CASCADE,
  inspector_user_id uuid NOT NULL DEFAULT auth.uid(),
  partner_request_id uuid,
  company text NOT NULL DEFAULT '',
  contact jsonb,
  price numeric NOT NULL,
  visit_slots jsonb NOT NULL DEFAULT '[]'::jsonb,
  visit_flexible boolean NOT NULL DEFAULT false,
  report_days integer NOT NULL,
  note text,
  status text NOT NULL DEFAULT 'submitted',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (request_id, inspector_user_id)
);
GRANT SELECT, INSERT, UPDATE ON public.inspection_offers TO authenticated;
GRANT ALL ON public.inspection_offers TO service_role;
ALTER TABLE public.inspection_offers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Offer parties read offers" ON public.inspection_offers FOR SELECT TO authenticated USING (
  inspector_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role) OR public.is_inspection_agent(request_id)
  OR EXISTS (SELECT 1 FROM public.inspection_requests r WHERE r.id = request_id AND r.client_user_id = auth.uid()));
CREATE POLICY "Covering inspectors submit offers" ON public.inspection_offers FOR INSERT TO authenticated
  WITH CHECK (inspector_user_id = auth.uid() AND status = 'submitted' AND public.can_offer_inspection(request_id));
CREATE POLICY "Inspectors revise offers while open" ON public.inspection_offers FOR UPDATE TO authenticated
  USING (inspector_user_id = auth.uid() AND status = 'submitted')
  WITH CHECK (inspector_user_id = auth.uid() AND status IN ('submitted','withdrawn') AND public.can_offer_inspection(request_id));
CREATE TRIGGER inspection_offers_updated_at BEFORE UPDATE ON public.inspection_offers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.inspection_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.inspection_requests(id) ON DELETE CASCADE,
  inspector_user_id uuid NOT NULL,
  inspector_email text NOT NULL DEFAULT '',
  author_id uuid NOT NULL DEFAULT auth.uid(),
  from_side text NOT NULL,
  author_name text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  call_slots jsonb NOT NULL DEFAULT '[]'::jsonb,
  chosen_slot text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.inspection_messages TO authenticated;
GRANT ALL ON public.inspection_messages TO service_role;
ALTER TABLE public.inspection_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Thread parties read inspection messages" ON public.inspection_messages FOR SELECT TO authenticated USING (
  inspector_user_id = auth.uid() OR public.is_inspection_agent(request_id) OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Thread parties write inspection messages" ON public.inspection_messages FOR INSERT TO authenticated WITH CHECK (
  author_id = auth.uid() AND (
    (from_side = 'inspector' AND inspector_user_id = auth.uid() AND public.can_offer_inspection(request_id))
    OR (from_side = 'agent' AND public.is_inspection_agent(request_id))));
CREATE POLICY "Thread parties pick call times" ON public.inspection_messages FOR UPDATE TO authenticated
  USING (inspector_user_id = auth.uid() OR public.is_inspection_agent(request_id))
  WITH CHECK (inspector_user_id = auth.uid() OR public.is_inspection_agent(request_id));

CREATE OR REPLACE FUNCTION public.inspection_agent_contact(_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r public.inspection_requests; pr public.partner_requests;
BEGIN
  SELECT * INTO r FROM public.inspection_requests WHERE id = _request_id;
  IF r.id IS NULL OR r.agent_email IS NULL THEN RETURN NULL; END IF;
  IF NOT (public.can_offer_inspection(_request_id) OR public.has_role(auth.uid(), 'admin'::app_role)) THEN RETURN NULL; END IF;
  SELECT * INTO pr FROM public.partner_requests WHERE lower(email) = lower(r.agent_email) AND partner_type = 'realtor' ORDER BY (status = 'approved') DESC LIMIT 1;
  RETURN jsonb_build_object('email', lower(r.agent_email),
    'name', trim(coalesce(pr.first_name,'') || ' ' || coalesce(pr.last_name,'')),
    'company', coalesce(pr.company_name,''), 'phone', coalesce(nullif(pr.phone,''), pr.company_phone, ''));
END; $$;

CREATE OR REPLACE FUNCTION public.select_inspection_offer(_offer_id uuid, _note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE o public.inspection_offers; r public.inspection_requests;
BEGIN
  SELECT * INTO o FROM public.inspection_offers WHERE id = _offer_id;
  IF o.id IS NULL OR o.status <> 'submitted' THEN RAISE EXCEPTION 'This offer is no longer available'; END IF;
  SELECT * INTO r FROM public.inspection_requests WHERE id = o.request_id FOR UPDATE;
  IF NOT (public.is_inspection_agent(r.id) OR public.has_role(auth.uid(), 'admin'::app_role)) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  IF r.status NOT IN ('open','awaiting_client') THEN RAISE EXCEPTION 'An inspector is already confirmed'; END IF;
  UPDATE public.inspection_requests SET status = 'awaiting_client', selected_offer_id = o.id, agent_selected_at = now(), agent_note = nullif(_note,''),
    history = history || jsonb_build_array(jsonb_build_object('status','awaiting_client','at',now(),'by','Buyer''s agent','note','Recommended ' || o.company))
  WHERE id = r.id;
END; $$;

CREATE OR REPLACE FUNCTION public.confirm_inspection_offer(_request_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r public.inspection_requests; o public.inspection_offers; first_slot timestamptz; inv jsonb; ref text;
BEGIN
  SELECT * INTO r FROM public.inspection_requests WHERE id = _request_id FOR UPDATE;
  IF r.id IS NULL OR r.client_user_id <> auth.uid() THEN RAISE EXCEPTION 'Not allowed'; END IF;
  IF r.status <> 'awaiting_client' OR r.selected_offer_id IS NULL THEN RAISE EXCEPTION 'There is no offer to confirm'; END IF;
  SELECT * INTO o FROM public.inspection_offers WHERE id = r.selected_offer_id;
  IF o.id IS NULL OR o.status <> 'submitted' THEN RAISE EXCEPTION 'This offer is no longer available'; END IF;
  first_slot := CASE WHEN jsonb_array_length(o.visit_slots) > 0 THEN (o.visit_slots->>0)::timestamptz ELSE NULL END;
  ref := upper(substr(replace(r.id::text,'-',''),1,8));
  inv := jsonb_build_array(
    jsonb_build_object('number','INS-' || ref, 'kind','inspection_service', 'issuedAt', now(),
      'from', jsonb_build_object('name', o.company, 'email', o.contact->>'email', 'phone', o.contact->>'phone'),
      'to', jsonb_build_object('name', r.client_label, 'email', r.client_email),
      'description', r.property_label || ' — ' || array_to_string(r.inspection_types, ', '),
      'amount', o.price, 'payableTo', o.company, 'due', 'On the inspection date, paid directly to the inspection company'),
    jsonb_build_object('number','LQF-' || ref, 'kind','loqal_fee', 'issuedAt', now(),
      'from', jsonb_build_object('name','Loqal'),
      'to', jsonb_build_object('name', o.company, 'email', o.contact->>'email'),
      'description', 'Loqal partner fee (10%) — ' || r.property_label,
      'amount', round(o.price * 0.10, 2), 'payableTo', 'Loqal', 'due', 'Within 10 business days after the inspection is completed'));
  UPDATE public.inspection_offers SET status = CASE WHEN id = o.id THEN 'selected' ELSE 'not_selected' END
    WHERE request_id = r.id AND status = 'submitted';
  UPDATE public.inspection_requests SET status = 'accepted', inspector_user_id = o.inspector_user_id, inspector_request_id = o.partner_request_id,
    inspector_company = o.company, inspector_contact = o.contact, fee = o.price, proposed_at = first_slot, client_confirmed_at = now(), invoices = inv,
    history = history || jsonb_build_array(jsonb_build_object('status','accepted','at',now(),'by', r.client_label, 'note','Client confirmed ' || o.company))
  WHERE id = r.id;
END; $$;