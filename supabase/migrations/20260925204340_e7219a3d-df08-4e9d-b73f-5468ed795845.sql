ALTER TABLE public.visa_support_requests ADD COLUMN IF NOT EXISTS visa_partner jsonb;

CREATE TABLE public.case_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_kind text NOT NULL,
  case_id uuid NOT NULL,
  client_user_id uuid NOT NULL,
  author_id uuid NOT NULL DEFAULT auth.uid(),
  author_name text NOT NULL DEFAULT '',
  from_loqal boolean NOT NULL DEFAULT false,
  kind text NOT NULL DEFAULT 'message',
  body text NOT NULL DEFAULT '',
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  call_slots jsonb NOT NULL DEFAULT '[]'::jsonb,
  chosen_slot text,
  reply_to uuid,
  answered_at timestamptz,
  read_by_client_at timestamptz,
  read_by_loqal_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.case_messages TO authenticated;
GRANT ALL ON public.case_messages TO service_role;
ALTER TABLE public.case_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clients read own case messages, admins all" ON public.case_messages FOR SELECT TO authenticated
  USING (auth.uid() = client_user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Clients write own case, admins any" ON public.case_messages FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND ((auth.uid() = client_user_id AND from_loqal = false) OR public.has_role(auth.uid(), 'admin')));
CREATE POLICY "Clients update own case messages, admins all" ON public.case_messages FOR UPDATE TO authenticated
  USING (auth.uid() = client_user_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = client_user_id OR public.has_role(auth.uid(), 'admin'));
CREATE INDEX case_messages_case_idx ON public.case_messages (case_kind, case_id, created_at);