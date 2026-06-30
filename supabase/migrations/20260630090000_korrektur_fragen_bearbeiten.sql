-- "Gemeinsam korrigieren": der eingeladene Trainer darf in seinen freigegebenen
-- Themengebieten der GEMEINSAMEN Prüfung Fragen tauschen/ergänzen – aber nur solange
-- die Prüfung im Entwurf ist.

-- 1) Pool der freigegebenen Themengebiete auch für Korrektur-Empfänger lesbar
--    (bisher nur 'eingeschraenkt') – nötig fürs Tauschen.
create or replace function public.darf_geteilte_frage_lesen(p_frage_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.pruefung_frage pf
    join public.pruefung p on p.id = pf.pruefung_id
    where pf.frage_id = p_frage_id and p.owner_id = auth.uid()
  ) or exists (
    select 1 from public.pruefung_freigabe f
    join public.frage fr on fr.id = p_frage_id
    where f.empfaenger_id = auth.uid()
      and f.status = 'angenommen'
      and f.modus in ('eingeschraenkt', 'korrektur')
      and fr.themengebiet_id = any (f.bearbeitbare_themengebiete)
  ) or exists (
    select 1 from public.pruefung_frage pf
    join public.pruefung_freigabe f on f.pruefung_id = pf.pruefung_id
    where pf.frage_id = p_frage_id
      and f.empfaenger_id = auth.uid()
      and f.status = 'angenommen'
      and f.modus = 'korrektur'
  );
$$;

-- 2) Fragen anlegen auch im Korrektur-Modus (freigegebene Themengebiete)
create or replace function public.darf_frage_anlegen_geteilt(p_kurs_id uuid, p_themengebiet_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.pruefung_freigabe f
    join public.themengebiet tg on tg.id = p_themengebiet_id
    where f.empfaenger_id = auth.uid()
      and f.status = 'angenommen'
      and f.modus in ('eingeschraenkt', 'korrektur')
      and p_themengebiet_id = any (f.bearbeitbare_themengebiete)
      and tg.kurs_id = p_kurs_id
  );
$$;

-- 3) Snapshot der GEMEINSAMEN Prüfung in freigegebenen Themengebieten ändern (Tauschen)
--    – nur im Entwurf.
create or replace function public.darf_pruefung_frage_bearbeiten_korrektur(p_pruefung_id uuid, p_themengebiet_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.pruefung p
    join public.pruefung_freigabe f on f.pruefung_id = p.id
    where p.id = p_pruefung_id
      and p.status = 'entwurf'
      and f.empfaenger_id = auth.uid()
      and f.status = 'angenommen'
      and f.modus = 'korrektur'
      and p_themengebiet_id = any (f.bearbeitbare_themengebiete)
  );
$$;
grant execute on function public.darf_pruefung_frage_bearbeiten_korrektur(uuid, uuid) to authenticated;

create policy "pruefung_frage_korrektur_bearbeiten" on public.pruefung_frage
  for update to authenticated
  using (public.darf_pruefung_frage_bearbeiten_korrektur(pruefung_id, themengebiet_id))
  with check (public.darf_pruefung_frage_bearbeiten_korrektur(pruefung_id, themengebiet_id));
