ALTER TABLE public.shared_records ADD COLUMN participants text[];

CREATE OR REPLACE FUNCTION public.shared_record_visible(_participants text[], _audience text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  em text := lower(coalesce(auth.jwt() ->> 'email', ''));
  p text[] := coalesce(_participants, CASE WHEN _audience IS NOT NULL THEN ARRAY[_audience] END);
  t text;
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN RETURN true; END IF;
  IF p IS NULL THEN RETURN true; END IF;
  IF em <> '' AND em = ANY(p) THEN RETURN true; END IF;
  FOREACH t IN ARRAY p LOOP
    IF t LIKE 'partner:%' AND EXISTS (
      SELECT 1 FROM public.partner_requests pr
      WHERE pr.id::text = substr(t, 9) AND (pr.user_id = auth.uid() OR lower(pr.email) = em)
    ) THEN RETURN true; END IF;
    IF t LIKE 'lenderstate:%' AND EXISTS (
      SELECT 1 FROM public.partner_requests pr
      WHERE (pr.user_id = auth.uid() OR lower(pr.email) = em)
        AND pr.status = 'approved' AND pr.partner_type = 'lender'
        AND (pr.all_states OR substr(t, 13) = ANY(pr.states))
    ) THEN RETURN true; END IF;
  END LOOP;
  RETURN false;
END;
$$;
REVOKE ALL ON FUNCTION public.shared_record_visible(text[], text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.shared_record_visible(text[], text) TO authenticated;

DROP POLICY IF EXISTS "Signed-in users read shared records addressed to them" ON public.shared_records;
CREATE POLICY "Users read shared records they take part in"
ON public.shared_records FOR SELECT TO authenticated
USING (public.shared_record_visible(participants, audience));

CREATE OR REPLACE FUNCTION public.put_shared_records(_rows jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  r jsonb;
  ex public.shared_records;
  em text := lower(coalesce(auth.jwt() ->> 'email', ''));
  parts text[];
  public_stores text[] := ARRAY['loqal.realtors.v2','loqal.staff.v1','loqal.directory.v1','loqal.lender.team.v2'];
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not signed in';
  END IF;
  FOR r IN SELECT * FROM jsonb_array_elements(_rows) LOOP
    SELECT * INTO ex FROM public.shared_records WHERE store = r->>'store' AND item_key = r->>'key';
    -- Only people who take part in a record may change it.
    IF ex.store IS NOT NULL AND NOT public.shared_record_visible(ex.participants, ex.audience) THEN
      CONTINUE;
    END IF;
    IF jsonb_typeof(r->'participants') = 'array' THEN
      SELECT array_agg(lower(x)) INTO parts FROM jsonb_array_elements_text(r->'participants') x;
    ELSE
      parts := NULL;
    END IF;
    IF parts IS NULL AND NOT (r->>'store' = ANY(public_stores)) THEN
      parts := ARRAY[em];
    END IF;
    IF coalesce((r->>'deleted')::boolean, false) AND ex.store IS NOT NULL THEN
      parts := coalesce(ex.participants, parts);
    END IF;
    INSERT INTO public.shared_records AS s (store, item_key, data, pos, deleted, audience, participants, updated_at, updated_by)
    VALUES (r->>'store', r->>'key', r->'data', coalesce((r->>'pos')::int, 0),
            coalesce((r->>'deleted')::boolean, false), nullif(r->>'audience', ''), parts, clock_timestamp(), auth.uid())
    ON CONFLICT (store, item_key) DO UPDATE SET
      data = CASE
        WHEN jsonb_typeof(excluded.data) = 'object' AND jsonb_typeof(s.data) = 'object'
          THEN excluded.data
            || CASE WHEN s.data ? 'readAt' AND NOT excluded.data ? 'readAt'
                    THEN jsonb_build_object('readAt', s.data->'readAt') ELSE '{}'::jsonb END
            || CASE WHEN (s.data->>'completed') = 'true' AND NOT excluded.data ? 'completed'
                    THEN jsonb_build_object('completed', true) ELSE '{}'::jsonb END
        ELSE excluded.data END,
      pos = excluded.pos,
      deleted = excluded.deleted,
      audience = excluded.audience,
      participants = excluded.participants,
      updated_at = clock_timestamp(),
      updated_by = auth.uid();
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.put_shared_records(jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.put_shared_records(jsonb) TO authenticated;