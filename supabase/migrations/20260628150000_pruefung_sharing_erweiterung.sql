-- Erweiterung Prüfungs-Sharing:
--  A) Lösch-Schutz: Kurs/Vorlage lassen sich nicht löschen, solange aktive
--     eingeschränkte Prüfungs-Freigaben darauf verweisen (sonst würde die
--     Prüfung des Empfängers brechen).
--  B) Feature 1: Empfänger einer eingeschränkten Freigabe darf in den
--     FREIGEGEBENEN Themengebieten EIGENE Fragen anlegen/bearbeiten. Diese
--     landen im Pool des teilenden Trainers (dessen Kurs). Bestehende Fragen
--     des Besitzers bleiben für den Empfänger unveränderbar.
-- Rein additiv.

-- ===== A) Lösch-Schutz =====
create or replace function public.schuetze_kurs_vor_loeschen()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (
    select 1 from public.pruefung_freigabe f
    join public.pruefung p on p.id = f.pruefung_id
    join public.pruefungsvorlage v on v.id = p.vorlage_id
    where v.kurs_id = old.id
      and f.modus = 'eingeschraenkt'
      and f.status in ('eingeladen', 'angenommen')
  ) then
    raise exception 'Dieser Kurs hat aktive Prüfungs-Freigaben (eingeschränkt). Bitte zuerst unter „Geteilt mit mir" widerrufen.';
  end if;
  return old;
end; $$;

create trigger schuetze_kurs_vor_loeschen
  before delete on public.kurs
  for each row execute function public.schuetze_kurs_vor_loeschen();

create or replace function public.schuetze_vorlage_vor_loeschen()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (
    select 1 from public.pruefung_freigabe f
    join public.pruefung p on p.id = f.pruefung_id
    where p.vorlage_id = old.id
      and f.modus = 'eingeschraenkt'
      and f.status in ('eingeladen', 'angenommen')
  ) then
    raise exception 'Diese Vorlage hat aktive Prüfungs-Freigaben (eingeschränkt). Bitte zuerst widerrufen.';
  end if;
  return old;
end; $$;

create trigger schuetze_vorlage_vor_loeschen
  before delete on public.pruefungsvorlage
  for each row execute function public.schuetze_vorlage_vor_loeschen();

-- ===== B) Feature 1: Empfänger-Fragen in freigegebenen Themengebieten =====

-- Ersteller einer Frage (für Rechte-Abgrenzung). NULL = Original des Kurs-Besitzers.
alter table public.frage
  add column erstellt_von uuid default auth.uid();

-- Darf der aktuelle Nutzer in (Kurs, Themengebiet) per eingeschränkter Freigabe Fragen anlegen?
create or replace function public.darf_frage_anlegen_geteilt(p_kurs_id uuid, p_themengebiet_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.pruefung_freigabe f
    join public.themengebiet tg on tg.id = p_themengebiet_id
    where f.empfaenger_id = auth.uid()
      and f.status = 'angenommen'
      and f.modus = 'eingeschraenkt'
      and p_themengebiet_id = any (f.bearbeitbare_themengebiete)
      and tg.kurs_id = p_kurs_id
  );
$$;

-- Darf der aktuelle Nutzer Antwortoptionen dieser (selbst angelegten) Frage schreiben?
create or replace function public.darf_antwortoption_geteilt(p_frage_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.frage fr
    where fr.id = p_frage_id
      and fr.erstellt_von = auth.uid()
      and public.darf_frage_anlegen_geteilt(fr.kurs_id, fr.themengebiet_id)
  );
$$;

grant execute on function public.darf_frage_anlegen_geteilt(uuid, uuid) to authenticated;
grant execute on function public.darf_antwortoption_geteilt(uuid) to authenticated;

-- Frage anlegen (nur freigegebene Themengebiete, erstellt_von = ich)
create policy "frage_anlegen_geteilt" on public.frage
  for insert to authenticated
  with check (
    erstellt_von = (select auth.uid())
    and public.darf_frage_anlegen_geteilt(kurs_id, themengebiet_id)
  );

-- Eigene (selbst angelegte) Fragen im freigegebenen Themengebiet ändern
create policy "frage_aendern_geteilt" on public.frage
  for update to authenticated
  using (
    erstellt_von = (select auth.uid())
    and public.darf_frage_anlegen_geteilt(kurs_id, themengebiet_id)
  )
  with check (
    erstellt_von = (select auth.uid())
    and public.darf_frage_anlegen_geteilt(kurs_id, themengebiet_id)
  );

-- Eigene (selbst angelegte) Fragen löschen
create policy "frage_loeschen_geteilt" on public.frage
  for delete to authenticated
  using (
    erstellt_von = (select auth.uid())
    and public.darf_frage_anlegen_geteilt(kurs_id, themengebiet_id)
  );

-- Antwortoptionen der eigenen neuen Fragen schreiben (insert/update/delete)
create policy "antwortoption_schreiben_geteilt" on public.antwortoption
  for all to authenticated
  using (public.darf_antwortoption_geteilt(frage_id))
  with check (public.darf_antwortoption_geteilt(frage_id));
