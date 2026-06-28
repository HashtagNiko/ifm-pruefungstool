-- Feature 2: Sharing-Modus 'korrektur' (Gemeinsam korrigieren).
-- Es wird KEINE Kopie erzeugt: Der eingeladene Trainer erhält Lesezugriff auf
-- DIESELBE Prüfung (Teilnehmer/Antworten/Fragen) und darf in seinen zugewiesenen
-- Themengebieten Feedback geben und einen Korrektur-Status setzen.
-- Status-Granularität: pro Teilnehmer x Themengebiet.
-- Rein additiv.

-- ===== 1) Modus erweitern =====
alter table public.pruefung_freigabe drop constraint pruefung_freigabe_modus_check;
alter table public.pruefung_freigabe add constraint pruefung_freigabe_modus_check
  check (modus in ('eingeschraenkt', 'kopie', 'korrektur'));

-- ===== 2) Korrektur-Status-Tabelle (pro Teilnehmer x Themengebiet) =====
create table public.korrektur_status (
  id             uuid primary key default gen_random_uuid(),
  teilnehmer_id  uuid not null references public.teilnehmer (id) on delete cascade,
  themengebiet_id uuid not null references public.themengebiet (id) on delete cascade,
  trainer_id     uuid not null references public.trainer (id) on delete cascade,
  trainer_name   text,
  korrigiert_am  timestamptz not null default now(),
  unique (teilnehmer_id, themengebiet_id)
);
create index korrektur_status_teilnehmer_idx on public.korrektur_status (teilnehmer_id);
alter table public.korrektur_status enable row level security;

-- ===== 3) Rechte-Helfer (SECURITY DEFINER) =====
-- Darf ich diese Prüfung im Korrektur-Kontext lesen? (Besitzer ODER angenommener Korrektor)
create or replace function public.darf_pruefung_lesen_korrektur(p_pruefung_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.pruefung p where p.id = p_pruefung_id and p.owner_id = auth.uid()
  ) or exists (
    select 1 from public.pruefung_freigabe f
    where f.pruefung_id = p_pruefung_id
      and f.empfaenger_id = auth.uid()
      and f.status = 'angenommen'
      and f.modus = 'korrektur'
  );
$$;

create or replace function public.darf_teilnehmer_lesen_korrektur(p_teilnehmer_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.darf_pruefung_lesen_korrektur(
    (select pruefung_id from public.teilnehmer where id = p_teilnehmer_id)
  );
$$;

-- Darf ich (Besitzer ODER zugewiesener Korrektor) dieses Themengebiet dieser Prüfung korrigieren?
create or replace function public.darf_themengebiet_korrigieren(p_pruefung_id uuid, p_themengebiet_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.pruefung p where p.id = p_pruefung_id and p.owner_id = auth.uid()
  ) or exists (
    select 1 from public.pruefung_freigabe f
    where f.pruefung_id = p_pruefung_id
      and f.empfaenger_id = auth.uid()
      and f.status = 'angenommen'
      and f.modus = 'korrektur'
      and p_themengebiet_id = any (f.bearbeitbare_themengebiete)
  );
$$;

-- Feedback-Schreibrecht im Korrektur-Kontext (nur Themengebiet/Frage-Ebene der zugewiesenen TG)
create or replace function public.darf_feedback_korrektur(p_teilnehmer_id uuid, p_ebene text, p_bezug_id uuid)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare
  v_pruefung uuid;
  v_tg uuid;
begin
  select pruefung_id into v_pruefung from public.teilnehmer where id = p_teilnehmer_id;
  if v_pruefung is null then return false; end if;
  if p_ebene = 'themengebiet' then
    return public.darf_themengebiet_korrigieren(v_pruefung, p_bezug_id);
  elsif p_ebene = 'frage' then
    select themengebiet_id into v_tg from public.frage where id = p_bezug_id;
    return public.darf_themengebiet_korrigieren(v_pruefung, v_tg);
  else
    return false; -- 'gesamt' bleibt dem Besitzer vorbehalten
  end if;
end; $$;

create or replace function public.darf_korrektur_status_schreiben(p_teilnehmer_id uuid, p_themengebiet_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.darf_themengebiet_korrigieren(
    (select pruefung_id from public.teilnehmer where id = p_teilnehmer_id),
    p_themengebiet_id
  );
$$;

grant execute on function public.darf_pruefung_lesen_korrektur(uuid) to authenticated;
grant execute on function public.darf_teilnehmer_lesen_korrektur(uuid) to authenticated;
grant execute on function public.darf_themengebiet_korrigieren(uuid, uuid) to authenticated;
grant execute on function public.darf_feedback_korrektur(uuid, text, uuid) to authenticated;
grant execute on function public.darf_korrektur_status_schreiben(uuid, uuid) to authenticated;

-- ===== 4) Bestehende Lese-Helfer um Korrektur-Branch erweitern =====
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
      and f.modus = 'eingeschraenkt'
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

create or replace function public.darf_geteiltes_themengebiet_lesen(p_tg_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.pruefung_frage pf
    join public.pruefung p on p.id = pf.pruefung_id
    where pf.themengebiet_id = p_tg_id and p.owner_id = auth.uid()
  ) or exists (
    select 1 from public.pruefung_freigabe f
    where f.empfaenger_id = auth.uid()
      and f.status = 'angenommen'
      and p_tg_id = any (f.bearbeitbare_themengebiete)
  ) or exists (
    select 1 from public.pruefung_frage pf
    join public.pruefung_freigabe f on f.pruefung_id = pf.pruefung_id
    where pf.themengebiet_id = p_tg_id
      and f.empfaenger_id = auth.uid()
      and f.status = 'angenommen'
      and f.modus = 'korrektur'
  );
$$;

create or replace function public.darf_geteilte_vorlage_lesen(p_vorlage_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.pruefung p
    where p.vorlage_id = p_vorlage_id and p.owner_id = auth.uid()
  ) or exists (
    select 1 from public.pruefung p
    join public.pruefung_freigabe f on f.pruefung_id = p.id
    where p.vorlage_id = p_vorlage_id
      and f.empfaenger_id = auth.uid()
      and f.status = 'angenommen'
      and f.modus = 'korrektur'
  );
$$;

-- ===== 5) Zusätzliche SELECT-Policies für den Korrektor =====
create policy "pruefung_lesen_korrektur" on public.pruefung
  for select to authenticated using (public.darf_pruefung_lesen_korrektur(id));

create policy "teilnehmer_lesen_korrektur" on public.teilnehmer
  for select to authenticated using (public.darf_pruefung_lesen_korrektur(pruefung_id));

create policy "antwort_lesen_korrektur" on public.antwort
  for select to authenticated using (public.darf_teilnehmer_lesen_korrektur(teilnehmer_id));

create policy "pruefung_frage_lesen_korrektur" on public.pruefung_frage
  for select to authenticated using (public.darf_pruefung_lesen_korrektur(pruefung_id));

-- ===== 6) Feedback im Korrektur-Kontext =====
create policy "feedback_lesen_korrektur" on public.feedback
  for select to authenticated
  using (public.darf_teilnehmer_lesen_korrektur(teilnehmer_id));

create policy "feedback_schreiben_korrektur" on public.feedback
  for all to authenticated
  using (public.darf_feedback_korrektur(teilnehmer_id, ebene, bezug_id))
  with check (public.darf_feedback_korrektur(teilnehmer_id, ebene, bezug_id));

-- ===== 7) RLS für korrektur_status =====
create policy "korrektur_status_lesen" on public.korrektur_status
  for select to authenticated
  using (public.darf_teilnehmer_lesen_korrektur(teilnehmer_id));

create policy "korrektur_status_schreiben" on public.korrektur_status
  for all to authenticated
  using (public.darf_korrektur_status_schreiben(teilnehmer_id, themengebiet_id))
  with check (
    trainer_id = (select auth.uid())
    and public.darf_korrektur_status_schreiben(teilnehmer_id, themengebiet_id)
  );

-- ===== 8) RPCs anpassen: 'korrektur' zulassen, beim Annehmen keine Kopie =====
create or replace function public.pruefung_teilen(
  p_pruefung_id uuid,
  p_email text,
  p_modus text,
  p_themengebiete uuid[] default '{}'
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_p public.pruefung%rowtype;
  v_name text;
  v_besitzer_email text;
  v_email text := lower(trim(p_email));
  v_tg uuid[] := coalesce(p_themengebiete, '{}');
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

  insert into public.pruefung_freigabe (
    pruefung_id, besitzer_id, besitzer_email, pruefung_name,
    empfaenger_email, modus, bearbeitbare_themengebiete, status)
  values (
    p_pruefung_id, v_uid, v_besitzer_email, coalesce(v_name, 'Prüfung'),
    v_email, p_modus, v_tg, 'eingeladen')
  on conflict (pruefung_id, empfaenger_email) do update
    set modus = excluded.modus,
        bearbeitbare_themengebiete = excluded.bearbeitbare_themengebiete,
        status = 'eingeladen',
        pruefung_name = excluded.pruefung_name,
        besitzer_email = excluded.besitzer_email,
        empfaenger_id = null;
end; $$;

create or replace function public.pruefung_freigabe_annehmen(p_freigabe_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_f public.pruefung_freigabe%rowtype;
  v_src public.pruefung%rowtype;
  v_neu uuid := gen_random_uuid();
begin
  select email into v_email from public.trainer where id = v_uid;
  select * into v_f from public.pruefung_freigabe where id = p_freigabe_id;
  if not found or lower(v_f.empfaenger_email) <> lower(coalesce(v_email, '')) then
    raise exception 'Keine Berechtigung für diese Einladung.';
  end if;

  if v_f.modus = 'kopie' then
    perform public.pruefung_klonen(v_f.pruefung_id);
  elsif v_f.modus = 'eingeschraenkt' then
    select * into v_src from public.pruefung where id = v_f.pruefung_id;
    insert into public.pruefung (id, owner_id, vorlage_id, status, late_join_modus, uebungsmodus, datum, quelle_freigabe_id)
      values (v_neu, v_uid, v_src.vorlage_id, 'entwurf', v_src.late_join_modus, false, null, v_f.id);
    insert into public.pruefung_frage (id, pruefung_id, frage_id, themengebiet_id, sortierung)
      select gen_random_uuid(), v_neu, pf.frage_id, pf.themengebiet_id, pf.sortierung
      from public.pruefung_frage pf where pf.pruefung_id = v_f.pruefung_id;
  end if;
  -- 'korrektur': keine Kopie, nur Zugriff freischalten

  update public.pruefung_freigabe set status = 'angenommen', empfaenger_id = v_uid where id = p_freigabe_id;
end; $$;
