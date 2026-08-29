ALTER TABLE public.partner_requests
  ADD COLUMN IF NOT EXISTS realtor_verification jsonb,
  ADD COLUMN IF NOT EXISTS profile_change_requests jsonb NOT NULL DEFAULT '[]'::jsonb;