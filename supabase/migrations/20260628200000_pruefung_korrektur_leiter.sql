-- Beim Modus 'korrektur' (eine geteilte Pruefung) kann optional der eingeladene
-- Trainer die Pruefung leiten (Lobby oeffnen/starten/beenden). Der Besitzer behaelt
-- die Kontrolle ebenfalls.
alter table public.pruefung_freigabe
  add column empfaenger_leitet boolean not null default false;

create or replace function public.darf_pruefung_leiten(p_pruefung_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.pruefung p where p.id = p_pruefung_id and p.owner_id = auth.uid()
  ) or exists (
    select 1 from public.pruefung_freigabe f
    where f.pruefung_id = p_pruefung_id
      and f.empfaenger_id = auth.uid()
      and f.status = 'angenommen'
      and f.modus = 'korrektur'
      and f.empfaenger_leitet = true
  );
$$;
grant execute on function public.darf_pruefung_leiten(uuid) to authenticated;

create policy "pruefung_leiten_update" on public.pruefung
  for update to authenticated
  using (public.darf_pruefung_leiten(id))
  with check (public.darf_pruefung_leiten(id));

drop function if exists public.pruefung_teilen(uuid, text, text, uuid[]);

create or replace function public.pruefung_teilen(
  p_pruefung_id uuid,
  p_email text,
  p_modus text,
  p_themengebiete uuid[] default '{}',
  p_empfaenger_leitet boolean default false
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_p public.pruefung%rowtype;
  v_name text;
  v_besitzer_email text;
  v_email text := lower(trim(p_email));
  v_tg uuid[] := coalesce(p_themengebiete, '{}');
  v_leitet boolean := coalesce(p_empfaenger_leitet, false);
begin
  if p_modus not in ('eingeschraenkt', 'kopie', 'korrektur') then
    raise exception 'Ungültiger Modus.';
  end if;
  select * into v_p from public.pruefung where id = p_pruefung_id;
  if not found or v_p.owner_id <> v_uid then
    raise exception 'Kein Zugriff auf diese Prüfung.';
  end if;
  select v.name into v_name from public.pruefungsvorlage v where v.id = v_p.vorlage_id;
  select email into v_besitzer_email from public.trainer where id = v_uid;
  if v_email = '' then raise exception 'Bitte eine E-Mail angeben.'; end if;
  if v_email = lower(coalesce(v_besitzer_email, '')) then
    raise exception 'Du kannst nicht an dich selbst teilen.';
  end if;
  if p_modus = 'kopie' then v_tg := '{}'; end if;
  if p_modus <> 'korrektur' then v_leitet := false; end if;

  insert into public.pruefung_freigabe (
    pruefung_id, besitzer_id, besitzer_email, pruefung_name,
    empfaenger_email, modus, bearbeitbare_themengebiete, empfaenger_leitet, status)
  values (
    p_pruefung_id, v_uid, v_besitzer_email, coalesce(v_name, 'Prüfung'),
    v_email, p_modus, v_tg, v_leitet, 'eingeladen')
  on conflict (pruefung_id, empfaenger_email) do update
    set modus = excluded.modus,
        bearbeitbare_themengebiete = excluded.bearbeitbare_themengebiete,
        empfaenger_leitet = excluded.empfaenger_leitet,
        status = 'eingeladen',
        pruefung_name = excluded.pruefung_name,
        besitzer_email = excluded.besitzer_email,
        empfaenger_id = null;
end; $$;

grant execute on function public.pruefung_teilen(uuid, text, text, uuid[], boolean) to authenticated;
