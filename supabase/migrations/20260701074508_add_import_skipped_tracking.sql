-- Traccia i documenti scartati durante l'import (duplicati per number+document_type+issue_date)
-- così l'utente può vedere ESATTAMENTE cosa non è stato inserito e perché, invece di un
-- conteggio finale silenzioso.
ALTER TABLE public.import_jobs
  ADD COLUMN IF NOT EXISTS skipped_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS skipped_details JSONB NOT NULL DEFAULT '[]'::jsonb;
