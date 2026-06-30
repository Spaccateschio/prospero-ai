DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.invoices'::regclass
      AND conname = 'invoices_dedup_unique'
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = 'invoices'
        AND indexname = 'idx_invoices_dedup'
    ) THEN
      ALTER TABLE public.invoices
        ADD CONSTRAINT invoices_dedup_unique
        UNIQUE USING INDEX idx_invoices_dedup;
    ELSE
      ALTER TABLE public.invoices
        ADD CONSTRAINT invoices_dedup_unique
        UNIQUE (company_id, direction, document_type, number, issue_date);
    END IF;
  END IF;
END $$;