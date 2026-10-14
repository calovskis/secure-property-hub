ALTER TABLE public.inspection_requests ADD COLUMN IF NOT EXISTS outside_agreement boolean NOT NULL DEFAULT false;
ALTER TABLE public.inspection_requests ADD COLUMN IF NOT EXISTS client_acknowledged_at timestamptz;
ALTER TABLE public.inspection_requests ADD COLUMN IF NOT EXISTS client_note text;