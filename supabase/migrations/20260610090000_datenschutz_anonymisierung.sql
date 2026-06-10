-- Datenschutz: 7-Tage-Anonymisierung der Teilnehmer (Konzept Abschnitt 10).
create extension if not exists pg_cron;

-- Anonymisiert alle Teilnehmer, deren Abgabe > 7 Tage her ist. Antworten/Punkte bleiben.
create or replace function public.anonymisiere_alte_teilnehmer()
returns integer language plpgsql security definer set search_path = '' as $$
declare v_anzahl int;
begin
  update public.teilnehmer
    set name = 'Anonymisiert', anonymisiert_am = now()
    where abgegeben_am is not null
      and abgegeben_am < now() - interval '7 days'
      and anonymisiert_am is null;
  get diagnostics v_anzahl = row_count;
  return v_anzahl;
end; $$;
revoke execute on function public.anonymisiere_alte_teilnehmer() from public, anon, authenticated;

-- täglich um 03:15 UTC
select cron.schedule('anonymisiere-teilnehmer', '15 3 * * *', $$select public.anonymisiere_alte_teilnehmer();$$);

-- Trainer-gesteuerte Sofort-Anonymisierung einer Prüfung
create or replace function public.pruefung_anonymisieren(p_pruefung_id uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_owner uuid; v_anzahl int;
begin
  select owner_id into v_owner from public.pruefung where id = p_pruefung_id;
  if v_owner is null or v_owner <> v_uid then raise exception 'Kein Zugriff.'; end if;
  update public.teilnehmer
    set name = 'Anonymisiert', anonymisiert_am = now()
    where pruefung_id = p_pruefung_id and anonymisiert_am is null;
  get diagnostics v_anzahl = row_count;
  return v_anzahl;
end; $$;
grant execute on function public.pruefung_anonymisieren(uuid) to authenticated;
