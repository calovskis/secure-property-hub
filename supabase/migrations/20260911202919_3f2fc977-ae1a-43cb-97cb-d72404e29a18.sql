CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
  OR (
    _role = 'admin'
    AND _user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.admin_emails
      WHERE email = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  )
$function$;

INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'admin'::app_role
FROM auth.users u
JOIN public.admin_emails a ON lower(u.email) = a.email
ON CONFLICT (user_id, role) DO NOTHING;