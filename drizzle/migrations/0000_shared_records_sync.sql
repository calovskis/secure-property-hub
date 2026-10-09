CREATE TABLE public.shared_records (
  store text NOT NULL,
  item_key text NOT NULL,
  data jsonb,
  pos integer NOT NULL DEFAULT 0,
  deleted boolean NOT NULL DEFAULT false,
  audience text,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid,
  PRIMARY KEY (store, item_key)
);
CREATE INDEX shared_records_updated_at_idx ON public.shared_records (updated_at);

GRANT SELECT ON public.shared_records TO authenticated;
GRANT ALL ON public.shared_records TO service_role;
ALTER TABLE public.shared_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed-in users read shared records addressed to them"
ON public.shared_records FOR SELECT TO authenticated
USING (
  audience IS NULL
  OR audience = lower(coalesce(auth.jwt() ->> 'email', ''))
  OR private.has_role(auth.uid(), 'admin'::app_role)
);

CREATE OR REPLACE FUNCTION public.put_shared_records(_rows jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not signed in';
  END IF;
  INSERT INTO public.shared_records AS s (store, item_key, data, pos, deleted, audience, updated_at, updated_by)
  SELECT r->>'store', r->>'key', r->'data', coalesce((r->>'pos')::int, 0),
         coalesce((r->>'deleted')::boolean, false), nullif(r->>'audience', ''), clock_timestamp(), auth.uid()
  FROM jsonb_array_elements(_rows) r
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
    updated_at = clock_timestamp(),
    updated_by = auth.uid();
END;
$$;
REVOKE ALL ON FUNCTION public.put_shared_records(jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.put_shared_records(jsonb) TO authenticated;