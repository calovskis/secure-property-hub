CREATE OR REPLACE FUNCTION public.has_inspection_offer(_request_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.inspection_offers o WHERE o.request_id = _request_id AND o.inspector_user_id = auth.uid())
$$;
CREATE OR REPLACE FUNCTION public.can_offer_inspection(_request_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.inspection_requests r WHERE r.id = _request_id
    AND (r.inspector_user_id = auth.uid() OR (r.status IN ('open','awaiting_client') AND public.inspector_covers(r.state))))
$$;
CREATE POLICY "Inspectors read requests they offered on" ON public.inspection_requests
  FOR SELECT TO authenticated USING (public.has_inspection_offer(id));