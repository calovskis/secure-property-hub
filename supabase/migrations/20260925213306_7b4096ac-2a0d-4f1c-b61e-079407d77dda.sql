ALTER TABLE public.entity_setup_requests
  ADD COLUMN IF NOT EXISTS manager jsonb,
  ADD COLUMN IF NOT EXISTS recommendation jsonb,
  ADD COLUMN IF NOT EXISTS recommendation_response jsonb,
  ADD COLUMN IF NOT EXISTS recommendation_history jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE OR REPLACE FUNCTION public.respond_entity_recommendation(_id uuid, _response jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r public.entity_setup_requests;
BEGIN
  SELECT * INTO r FROM public.entity_setup_requests WHERE id = _id;
  IF r.id IS NULL OR r.user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  IF r.recommendation IS NULL THEN
    RAISE EXCEPTION 'No recommendation to respond to';
  END IF;
  UPDATE public.entity_setup_requests
     SET recommendation_response = _response,
         status = CASE WHEN (_response->>'decision') = 'confirmed' THEN 'structure_agreed' ELSE status END,
         history = history || jsonb_build_array(jsonb_build_object(
           'status', CASE WHEN (_response->>'decision') = 'confirmed' THEN 'structure_agreed' ELSE status END,
           'at', now(),
           'by', client_name,
           'note', CASE WHEN (_response->>'decision') = 'confirmed' THEN 'Client confirmed the entity recommendation' ELSE 'Client asked for changes to the recommendation' END))
   WHERE id = _id;
END;
$$;

REVOKE ALL ON FUNCTION public.respond_entity_recommendation(uuid, jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.respond_entity_recommendation(uuid, jsonb) TO authenticated;