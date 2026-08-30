ALTER TABLE public.partner_requests
  ADD COLUMN IF NOT EXISTS reviewer_id text,
  ADD COLUMN IF NOT EXISTS reviewer_name text,
  ADD COLUMN IF NOT EXISTS review_stage text NOT NULL DEFAULT 'unassigned',
  ADD COLUMN IF NOT EXISTS review_note text,
  ADD COLUMN IF NOT EXISTS review_updated_at timestamptz;