ALTER POLICY "Clients, matching inspectors and admins read inspection request" ON public.inspection_requests
USING ((client_user_id = auth.uid()) OR (inspector_user_id = auth.uid()) OR private.has_role(auth.uid(), 'admin'::public.app_role) OR ((status = 'open'::text) AND public.inspector_covers(state)));

ALTER POLICY "Client, assigned inspector or admin update" ON public.inspection_requests
USING ((client_user_id = auth.uid()) OR (inspector_user_id = auth.uid()) OR private.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK ((client_user_id = auth.uid()) OR (inspector_user_id = auth.uid()) OR private.has_role(auth.uid(), 'admin'::public.app_role));

ALTER POLICY "Inspection report upload" ON storage.objects
WITH CHECK ((bucket_id = 'inspection-reports'::text) AND (EXISTS (SELECT 1 FROM public.inspection_requests ir WHERE ((ir.id)::text = (storage.foldername(objects.name))[1]) AND ((ir.inspector_user_id = auth.uid()) OR private.has_role(auth.uid(), 'admin'::public.app_role)))));