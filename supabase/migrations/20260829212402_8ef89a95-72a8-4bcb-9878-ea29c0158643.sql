ALTER TABLE public.partner_requests
  ADD COLUMN IF NOT EXISTS admin_requests jsonb NOT NULL DEFAULT '[]'::jsonb;