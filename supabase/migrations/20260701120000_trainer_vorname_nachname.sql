-- Trainer um Vor- und Nachname erweitern (Pflege über Supabase-Dashboard).
-- Wird als voller Anzeigename für Korrektur-Chips und PDF-Attribution verwendet.
alter table public.trainer add column vorname text;
alter table public.trainer add column nachname text;
