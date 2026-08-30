create policy "Partner document owners can upload"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'partner-documents'
    and (storage.foldername(name))[1] = 'requests'
    and exists (
      select 1 from public.partner_requests
      where id = (storage.foldername(name))[2]::uuid
        and user_id = auth.uid()
    )
  );

create policy "Partner document owners and admins can read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'partner-documents'
    and (
      exists (
        select 1 from public.partner_requests
        where id = (storage.foldername(name))[2]::uuid
          and user_id = auth.uid()
      )
      or public.has_role(auth.uid(), 'admin')
    )
  );

create policy "Partner document owners can update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'partner-documents'
    and exists (
      select 1 from public.partner_requests
      where id = (storage.foldername(name))[2]::uuid
        and user_id = auth.uid()
    )
  )
  with check (
    bucket_id = 'partner-documents'
    and exists (
      select 1 from public.partner_requests
      where id = (storage.foldername(name))[2]::uuid
        and user_id = auth.uid()
    )
  );

create policy "Partner document owners can delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'partner-documents'
    and exists (
      select 1 from public.partner_requests
      where id = (storage.foldername(name))[2]::uuid
        and user_id = auth.uid()
    )
  );