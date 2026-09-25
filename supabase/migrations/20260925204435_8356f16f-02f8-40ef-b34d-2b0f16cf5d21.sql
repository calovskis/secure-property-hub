CREATE POLICY "Case files read by client or admin" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'case-files' AND (auth.uid()::text = (storage.foldername(name))[1] OR private.has_role(auth.uid(), 'admin'::public.app_role)));
CREATE POLICY "Case files upload by client or admin" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'case-files' AND (auth.uid()::text = (storage.foldername(name))[1] OR private.has_role(auth.uid(), 'admin'::public.app_role)));