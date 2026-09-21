CREATE TABLE public.profile_deletions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  role_label TEXT NOT NULL DEFAULT '',
  reason TEXT NOT NULL DEFAULT '',
  requested_by TEXT NOT NULL DEFAULT '',
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  self_requested BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','deleted','restored','cancelled')),
  confirmed_by TEXT,
  confirmed_at TIMESTAMPTZ,
  recoverable_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX profile_deletions_live_email_idx ON public.profile_deletions (lower(email)) WHERE status IN ('requested','deleted');
GRANT SELECT, INSERT, UPDATE ON public.profile_deletions TO authenticated;
GRANT ALL ON public.profile_deletions TO service_role;
ALTER TABLE public.profile_deletions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users can view deletion records"
  ON public.profile_deletions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can request their own deletion, admins anyone's"
  ON public.profile_deletions FOR INSERT TO authenticated
  WITH CHECK (lower(email) = lower(coalesce(auth.jwt() ->> 'email','')) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update deletion records"
  ON public.profile_deletions FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));