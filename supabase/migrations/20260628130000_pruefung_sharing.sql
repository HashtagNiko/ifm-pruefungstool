-- Prüfungs-Freigaben: eine einzelne Prüfung teilen.
-- Zwei Modi:
--   'kopie'         -> Empfänger klont Kurs + Pool + Vorlage + diese Prüfung in sein Konto.
--   'eingeschraenkt'-> Empfänger erhält eine eigene Prüfung (eigene Teilnehmer/Lobby),
--                      deren Snapshot auf die Fragen des Besitzers verweist. Tauschen/Würfeln
--                      ist nur in den freigegebenen Themengebieten möglich (sonst gesperrt).
-- Migration ist rein additiv (keine bestehende Tabelle/Policy wird verändert).

-- ===== 1) Tabelle =====
create table public.pruefung_freigabe (
  id                         uuid primary key default gen_random_uuid(),
  pruefung_id                uuid not null references public.pruefung (id) on delete cascade,
  besitzer_id                uuid not null references public.trainer (id) on delete cascade,
  besitzer_email             text,
  pruefung_name              text not null,
  empfaenger_email           text not null,
  empfaenger_id              uuid references public.trainer (id) on delete set null,
  modus                      text not null check (modus in ('eingeschraenkt', 'kopie')),
  bearbeitbare_themengebiete uuid[] not null default '{}',
  status                     text not null default 'eingeladen'
                               check (status in ('eingeladen', 'angenommen', 'abgelehnt')),
  created_at                 timestamptz not null default now(),
  unique (pruefung_id, empfaenger_email)
);
create index pruefung_freigabe_pruefung_id_idx on public.pruefung_freigabe (pruefung_id);
create index pruefung_freigabe_besitzer_id_idx on public.pruefung_freigabe (besitzer_id);
create index pruefung_freigabe_empfaenger_id_idx on public.pruefung_freigabe (empfaenger_id);
create index pruefung_freigabe_empfaenger_email_idx on public.pruefung_freigabe (lower(empfaenger_email));

-- Herkunfts-Verweis auf der (eingeschränkt geteilten) Empfänger-Prüfung
alter table public.pruefung
  add column quelle_freigabe_id uuid references public.pruefung_freigabe (id) on delete set null;

-- ===== 2) RLS für pruefung_freigabe =====
alter table public.pruefung_freigabe enable row level security;

create policy "pruefung_freigabe_besitzer" on public.pruefung_freigabe
  for all to authenticated
  using (besitzer_id = (select auth.uid()))
  with check (besitzer_id = (select auth.uid()));

create policy "pruefung_freigabe_empfaenger_select" on public.pruefung_freigabe
  for select to authenticated
  using (
    lower(empfaenger_email) = lower((select t.email from public.trainer t where t.id = (select auth.uid())))
  );

-- ===== 3) Lese-Helfer (SECURITY DEFINER, vermeiden RLS-Rekursion) =====
-- Eine Frage des Besitzers ist für den Empfänger lesbar, wenn sie
--   (a) im Snapshot einer Prüfung liegt, die dem Empfänger gehört, ODER
--   (b) in einem freigegebenen Themengebiet einer angenommenen eingeschränkten Freigabe liegt.
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
  );
$$;

create or replace function public.darf_geteilte_vorlage_lesen(p_vorlage_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.pruefung p
    where p.vorlage_id = p_vorlage_id and p.owner_id = auth.uid()
  );
$$;

grant execute on function public.darf_geteilte_frage_lesen(uuid) to authenticated;
grant execute on function public.darf_geteiltes_themengebiet_lesen(uuid) to authenticated;
grant execute on function public.darf_geteilte_vorlage_lesen(uuid) to authenticated;

-- ===== 4) Zusätzliche SELECT-Policies (additiv, OR-verknüpft mit den bestehenden) =====
create policy "frage_lesen_geteilt" on public.frage
  for select to authenticated using (public.darf_geteilte_frage_lesen(id));

create policy "antwortoption_lesen_geteilt" on public.antwortoption
  for select to authenticated using (public.darf_geteilte_frage_lesen(frage_id));

create policy "themengebiet_lesen_geteilt" on public.themengebiet
  for select to authenticated using (public.darf_geteiltes_themengebiet_lesen(id));

create policy "pruefungsvorlage_lesen_geteilt" on public.pruefungsvorlage
  for select to authenticated using (public.darf_geteilte_vorlage_lesen(id));

-- ===== 5) RPC: Prüfung teilen (nur Besitzer) =====
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
  if p_modus not in ('eingeschraenkt', 'kopie') then
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

-- ===== 6) RPC: Prüfung vollständig klonen (Kurs + Pool + Vorlage + diese Prüfung) =====
create or replace function public.pruefung_klonen(p_pruefung_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_src public.pruefung%rowtype;
  v_kurs_alt uuid;
  v_kurs_neu uuid := gen_random_uuid();
  v_vorlage_neu uuid;
  v_pruefung_neu uuid := gen_random_uuid();
  v_kursname text;
begin
  select * into v_src from public.pruefung where id = p_pruefung_id;
  if not found then raise exception 'Prüfung nicht gefunden.'; end if;
  select v.kurs_id into v_kurs_alt from public.pruefungsvorlage v where v.id = v_src.vorlage_id;

  select name into v_kursname from public.kurs where id = v_kurs_alt;
  insert into public.kurs (id, owner_id, name, beschreibung)
    select v_kurs_neu, v_uid, coalesce(v_kursname, 'Kurs') || ' (Kopie)', beschreibung
    from public.kurs where id = v_kurs_alt;

  create temp table _tg (alt uuid, neu uuid) on commit drop;
  insert into _tg select id, gen_random_uuid() from public.themengebiet where kurs_id = v_kurs_alt;
  insert into public.themengebiet (id, kurs_id, name, sortierung)
    select m.neu, v_kurs_neu, t.name, t.sortierung
    from public.themengebiet t join _tg m on m.alt = t.id;

  create temp table _fr (alt uuid, neu uuid) on commit drop;
  insert into _fr select id, gen_random_uuid() from public.frage where kurs_id = v_kurs_alt;
  insert into public.frage (id, kurs_id, themengebiet_id, text, typ, erstellt_am)
    select fm.neu, v_kurs_neu, tg.neu, f.text, f.typ, f.erstellt_am
    from public.frage f
      join _fr fm on fm.alt = f.id
      left join _tg tg on tg.alt = f.themengebiet_id
    where f.kurs_id = v_kurs_alt;

  insert into public.antwortoption (id, frage_id, text, ist_richtig, sortierung)
    select gen_random_uuid(), fm.neu, ao.text, ao.ist_richtig, ao.sortierung
    from public.antwortoption ao join _fr fm on fm.alt = ao.frage_id;

  create temp table _vl (alt uuid, neu uuid) on commit drop;
  insert into _vl select id, gen_random_uuid() from public.pruefungsvorlage where kurs_id = v_kurs_alt;
  insert into public.pruefungsvorlage (id, kurs_id, name, dauer_minuten, bestehensschwelle_prozent, bestehensschwelle_pro_themengebiet_prozent)
    select vm.neu, v_kurs_neu, v.name, v.dauer_minuten, v.bestehensschwelle_prozent, v.bestehensschwelle_pro_themengebiet_prozent
    from public.pruefungsvorlage v join _vl vm on vm.alt = v.id;

  insert into public.vorlage_themengebiet (id, vorlage_id, themengebiet_id, anzahl_fragen, punkte_gesamt)
    select gen_random_uuid(), vm.neu, tg.neu, vt.anzahl_fragen, vt.punkte_gesamt
    from public.vorlage_themengebiet vt
      join _vl vm on vm.alt = vt.vorlage_id
      join _tg tg on tg.alt = vt.themengebiet_id;

  select neu into v_vorlage_neu from _vl where alt = v_src.vorlage_id;

  insert into public.pruefung (id, owner_id, vorlage_id, status, late_join_modus, uebungsmodus, datum)
    values (v_pruefung_neu, v_uid, v_vorlage_neu, 'entwurf', v_src.late_join_modus, false, null);

  insert into public.pruefung_frage (id, pruefung_id, frage_id, themengebiet_id, sortierung)
    select gen_random_uuid(), v_pruefung_neu, fm.neu, tg.neu, pf.sortierung
    from public.pruefung_frage pf
      join _fr fm on fm.alt = pf.frage_id
      left join _tg tg on tg.alt = pf.themengebiet_id
    where pf.pruefung_id = p_pruefung_id;

  return v_pruefung_neu;
end; $$;

-- ===== 7) RPC: Einladung annehmen =====
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
  else
    select * into v_src from public.pruefung where id = v_f.pruefung_id;
    insert into public.pruefung (id, owner_id, vorlage_id, status, late_join_modus, uebungsmodus, datum, quelle_freigabe_id)
      values (v_neu, v_uid, v_src.vorlage_id, 'entwurf', v_src.late_join_modus, false, null, v_f.id);
    insert into public.pruefung_frage (id, pruefung_id, frage_id, themengebiet_id, sortierung)
      select gen_random_uuid(), v_neu, pf.frage_id, pf.themengebiet_id, pf.sortierung
      from public.pruefung_frage pf where pf.pruefung_id = v_f.pruefung_id;
  end if;

  update public.pruefung_freigabe set status = 'angenommen', empfaenger_id = v_uid where id = p_freigabe_id;
end; $$;

-- ===== 8) RPC: Einladung ablehnen =====
create or replace function public.pruefung_freigabe_ablehnen(p_freigabe_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_f public.pruefung_freigabe%rowtype;
begin
  select email into v_email from public.trainer where id = v_uid;
  select * into v_f from public.pruefung_freigabe where id = p_freigabe_id;
  if not found or lower(v_f.empfaenger_email) <> lower(coalesce(v_email, '')) then
    raise exception 'Keine Berechtigung für diese Einladung.';
  end if;
  update public.pruefung_freigabe set status = 'abgelehnt', empfaenger_id = v_uid where id = p_freigabe_id;
end; $$;

grant execute on function public.pruefung_teilen(uuid, text, text, uuid[]) to authenticated;
grant execute on function public.pruefung_freigabe_annehmen(uuid) to authenticated;
grant execute on function public.pruefung_freigabe_ablehnen(uuid) to authenticated;
revoke execute on function public.pruefung_klonen(uuid) from public, anon, authenticated;
