-- Kurs teilen (nur Besitzer). Upsert: erneutes Teilen aktualisiert Modus/Status.
create or replace function public.kurs_teilen(p_kurs_id uuid, p_email text, p_modus text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_kurs public.kurs%rowtype;
  v_besitzer_email text;
  v_email text := lower(trim(p_email));
begin
  if p_modus not in ('nur_verwenden', 'gemeinsam', 'kopie') then
    raise exception 'Ungültiger Modus.';
  end if;
  select * into v_kurs from public.kurs where id = p_kurs_id;
  if not found or v_kurs.owner_id <> v_uid then
    raise exception 'Kein Zugriff auf diesen Kurs.';
  end if;
  select email into v_besitzer_email from public.trainer where id = v_uid;
  if v_email = lower(coalesce(v_besitzer_email, '')) then
    raise exception 'Du kannst nicht an dich selbst teilen.';
  end if;
  if v_email = '' then raise exception 'Bitte eine E-Mail angeben.'; end if;

  insert into public.kurs_freigabe (kurs_id, besitzer_id, besitzer_email, kurs_name, empfaenger_email, modus, status)
  values (p_kurs_id, v_uid, v_besitzer_email, v_kurs.name, v_email, p_modus, 'eingeladen')
  on conflict (kurs_id, empfaenger_email) do update
    set modus = excluded.modus,
        status = 'eingeladen',
        kurs_name = excluded.kurs_name,
        besitzer_email = excluded.besitzer_email,
        empfaenger_id = null;
end; $$;

-- Klont einen Kurs vollständig in das Konto des aktuellen Nutzers; gibt neue kurs_id zurück.
create or replace function public.kurs_klonen(p_kurs_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_neu uuid := gen_random_uuid();
  v_name text;
begin
  select name into v_name from public.kurs where id = p_kurs_id;
  insert into public.kurs (id, owner_id, name, beschreibung)
    select v_neu, v_uid, v_name || ' (Kopie)', beschreibung
    from public.kurs where id = p_kurs_id;

  create temp table _tg (alt uuid, neu uuid) on commit drop;
  insert into _tg select id, gen_random_uuid() from public.themengebiet where kurs_id = p_kurs_id;
  insert into public.themengebiet (id, kurs_id, name, sortierung)
    select m.neu, v_neu, t.name, t.sortierung
    from public.themengebiet t join _tg m on m.alt = t.id;

  create temp table _fr (alt uuid, neu uuid) on commit drop;
  insert into _fr select id, gen_random_uuid() from public.frage where kurs_id = p_kurs_id;
  insert into public.frage (id, kurs_id, themengebiet_id, text, typ, erstellt_am)
    select fm.neu, v_neu, tg.neu, f.text, f.typ, f.erstellt_am
    from public.frage f
      join _fr fm on fm.alt = f.id
      left join _tg tg on tg.alt = f.themengebiet_id
    where f.kurs_id = p_kurs_id;

  insert into public.antwortoption (id, frage_id, text, ist_richtig, sortierung)
    select gen_random_uuid(), fm.neu, ao.text, ao.ist_richtig, ao.sortierung
    from public.antwortoption ao join _fr fm on fm.alt = ao.frage_id;

  create temp table _vl (alt uuid, neu uuid) on commit drop;
  insert into _vl select id, gen_random_uuid() from public.pruefungsvorlage where kurs_id = p_kurs_id;
  insert into public.pruefungsvorlage (id, kurs_id, name, dauer_minuten, bestehensschwelle_prozent, bestehensschwelle_pro_themengebiet_prozent)
    select vm.neu, v_neu, v.name, v.dauer_minuten, v.bestehensschwelle_prozent, v.bestehensschwelle_pro_themengebiet_prozent
    from public.pruefungsvorlage v join _vl vm on vm.alt = v.id;

  insert into public.vorlage_themengebiet (id, vorlage_id, themengebiet_id, anzahl_fragen, punkte_gesamt)
    select gen_random_uuid(), vm.neu, tg.neu, vt.anzahl_fragen, vt.punkte_gesamt
    from public.vorlage_themengebiet vt
      join _vl vm on vm.alt = vt.vorlage_id
      join _tg tg on tg.alt = vt.themengebiet_id;

  return v_neu;
end; $$;

-- Einladung annehmen. Bei Modus 'kopie' wird geklont.
create or replace function public.freigabe_annehmen(p_freigabe_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_fr public.kurs_freigabe%rowtype;
begin
  select email into v_email from public.trainer where id = v_uid;
  select * into v_fr from public.kurs_freigabe where id = p_freigabe_id;
  if not found or lower(v_fr.empfaenger_email) <> lower(coalesce(v_email, '')) then
    raise exception 'Keine Berechtigung für diese Einladung.';
  end if;

  if v_fr.modus = 'kopie' then
    perform public.kurs_klonen(v_fr.kurs_id);
  end if;

  update public.kurs_freigabe
    set status = 'angenommen', empfaenger_id = v_uid
    where id = p_freigabe_id;
end; $$;

create or replace function public.freigabe_ablehnen(p_freigabe_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_fr public.kurs_freigabe%rowtype;
begin
  select email into v_email from public.trainer where id = v_uid;
  select * into v_fr from public.kurs_freigabe where id = p_freigabe_id;
  if not found or lower(v_fr.empfaenger_email) <> lower(coalesce(v_email, '')) then
    raise exception 'Keine Berechtigung für diese Einladung.';
  end if;
  update public.kurs_freigabe set status = 'abgelehnt', empfaenger_id = v_uid where id = p_freigabe_id;
end; $$;

grant execute on function public.kurs_teilen(uuid, text, text) to authenticated;
grant execute on function public.freigabe_annehmen(uuid) to authenticated;
grant execute on function public.freigabe_ablehnen(uuid) to authenticated;
revoke execute on function public.kurs_klonen(uuid) from public, anon, authenticated;
