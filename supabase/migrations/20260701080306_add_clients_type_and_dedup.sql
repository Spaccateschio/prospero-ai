-- La tabella clients diventa l'anagrafica unificata Clienti/Fornitori (import/export Excel).
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'cliente'
    CHECK (type IN ('cliente', 'fornitore', 'entrambi'));

-- Evita duplicati quando si importa più volte lo stesso file: stessa azienda + stessa P.IVA
-- (solo se la P.IVA è valorizzata; i record senza P.IVA restano sempre inseriti come nuovi).
CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_dedup_vat
  ON public.clients(company_id, type, vat)
  WHERE vat IS NOT NULL AND vat <> '';
