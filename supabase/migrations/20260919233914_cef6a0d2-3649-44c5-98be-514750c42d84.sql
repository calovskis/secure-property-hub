ALTER TABLE public.partner_requests
  ADD COLUMN IF NOT EXISTS agreement_countersigned_by text,
  ADD COLUMN IF NOT EXISTS agreement_countersigned_title text;