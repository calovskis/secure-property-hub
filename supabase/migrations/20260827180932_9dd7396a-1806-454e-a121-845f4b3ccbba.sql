CREATE TABLE public.app_user_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  connector_id text NOT NULL,
  connection_key_ciphertext text NOT NULL,
  agent_ref text,
  agent_email text,
  account_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, connector_id)
);

CREATE INDEX app_user_connections_agent_ref_idx ON public.app_user_connections (connector_id, agent_ref);
CREATE INDEX app_user_connections_agent_email_idx ON public.app_user_connections (connector_id, agent_email);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_user_connections TO service_role;
ALTER TABLE public.app_user_connections ENABLE ROW LEVEL SECURITY;