ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'cliente'
    CHECK (type IN ('cliente', 'fornitore', 'entrambi'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_dedup_vat
  ON public.clients(company_id, type, vat)
  WHERE vat IS NOT NULL AND vat <> '';