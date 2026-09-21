ALTER TABLE public.profile_deletions
  ADD COLUMN closed_by TEXT,
  ADD COLUMN closed_at TIMESTAMPTZ,
  ADD COLUMN close_note TEXT;