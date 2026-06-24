
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_extractions_used INTEGER NOT NULL DEFAULT 0;

-- Aggiorna trigger handle_new_user per marcare gli utenti anonimi come demo
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, is_demo, onboarding_completed)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    COALESCE(NEW.is_anonymous, false),
    COALESCE(NEW.is_anonymous, false)
  );
  RETURN NEW;
END;
$$;

-- Helper: verifica se l'utente corrente è demo
CREATE OR REPLACE FUNCTION public.is_demo_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT is_demo FROM public.profiles WHERE id = auth.uid()), false);
$$;

-- Helper: incrementa contatore estrazioni AI e ritorna nuovo valore
CREATE OR REPLACE FUNCTION public.increment_ai_extractions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_count integer;
BEGIN
  UPDATE public.profiles
     SET ai_extractions_used = ai_extractions_used + 1
   WHERE id = auth.uid()
   RETURNING ai_extractions_used INTO new_count;
  RETURN COALESCE(new_count, 0);
END;
$$;
