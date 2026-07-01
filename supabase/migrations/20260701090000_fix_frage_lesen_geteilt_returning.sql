-- Fix: Frage anlegen als Empfänger einer geteilten Prüfung scheiterte mit
-- "new row violates row-level security policy for table frage". Ursache wie beim
-- Kurs-Fix: Der Client nutzt .insert().select() (= INSERT ... RETURNING). Beim
-- RETURNING prüft Postgres die SELECT-Policy auf der neuen Zeile; darf_geteilte_frage_lesen
-- fragt dabei die frage-Tabelle ERNEUT ab und sieht die gerade eingefügte Zeile noch nicht.
-- Lösung: die Empfänger-Lese-Policy prüft die Freigabe DIREKT an den Spalten der Zeile
-- (kurs_id, themengebiet_id), statt die frage-Tabelle neu abzufragen.
create or replace function public.darf_frage_zeile_lesen_geteilt(
  p_frage_id uuid, p_kurs_id uuid, p_themengebiet_id uuid
) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.pruefung_frage pf
    join public.pruefung p on p.id = pf.pruefung_id
    where pf.frage_id = p_frage_id and p.owner_id = auth.uid()
  ) or exists (
    select 1 from public.pruefung_freigabe f
    where f.empfaenger_id = auth.uid()
      and f.status = 'angenommen'
      and f.modus in ('eingeschraenkt', 'korrektur')
      and p_themengebiet_id = any (f.bearbeitbare_themengebiete)
  ) or exists (
    select 1 from public.pruefung_frage pf
    join public.pruefung_freigabe f on f.pruefung_id = pf.pruefung_id
    where pf.frage_id = p_frage_id
      and f.empfaenger_id = auth.uid()
      and f.status = 'angenommen'
      and f.modus = 'korrektur'
  ) or exists (
    select 1 from public.pruefung_freigabe f
    join public.pruefung p on p.id = f.pruefung_id
    join public.pruefungsvorlage v on v.id = p.vorlage_id
    where f.empfaenger_id = auth.uid()
      and f.status = 'angenommen'
      and f.modus in ('eingeschraenkt', 'korrektur')
      and p_kurs_id = v.kurs_id
  );
$$;
grant execute on function public.darf_frage_zeile_lesen_geteilt(uuid, uuid, uuid) to authenticated;

drop policy "frage_lesen_geteilt" on public.frage;
create policy "frage_lesen_geteilt" on public.frage
  for select to authenticated
  using (public.darf_frage_zeile_lesen_geteilt(id, kurs_id, themengebiet_id));
