CREATE POLICY "Users can manage their own app connections"
ON public.app_user_connections
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);