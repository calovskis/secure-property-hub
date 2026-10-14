CREATE OR REPLACE FUNCTION public.notify_matching_inspectors()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE pr record; nid text; em text;
BEGIN
  IF NEW.status <> 'open' THEN RETURN NEW; END IF;
  FOR pr IN
    SELECT p.id, lower(p.email) AS email FROM public.partner_requests p
    WHERE p.status = 'approved' AND p.partner_type = 'inspector' AND p.email <> ''
      AND (p.all_states OR NEW.state = ANY(p.states) OR EXISTS (
        SELECT 1 FROM jsonb_array_elements(coalesce(p.inspector_profile->'coverage','[]'::jsonb)) c WHERE c->>'state' = NEW.state))
  LOOP
    em := pr.email;
    nid := 'inspection-job-' || NEW.id::text || '-' || pr.id::text;
    INSERT INTO public.shared_records (store, item_key, data, pos, deleted, audience, participants, updated_at)
    VALUES ('loqal.notifications.v1', 'items[]i:' || nid,
      jsonb_build_object('id', nid, 'to', em,
        'title', CASE WHEN NEW.outside_agreement THEN 'New additional inspection request in your area' ELSE 'New inspection request in your area' END,
        'body', NEW.property_label || ' (' || NEW.state || ') — ' || array_to_string(NEW.inspection_types, ', ') || '. Accept it with your fee and proposed date.',
        'href', '/partner?tab=inspections', 'severity', 'info', 'badge', 'New job', 'createdAt', to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
      0, false, NULL, ARRAY[em], clock_timestamp(), NEW.client_user_id)
    ON CONFLICT (store, item_key) DO NOTHING;
  END LOOP;
  RETURN NEW;
END; $$;

CREATE TRIGGER inspection_requests_notify_inspectors
AFTER INSERT ON public.inspection_requests
FOR EACH ROW EXECUTE FUNCTION public.notify_matching_inspectors();