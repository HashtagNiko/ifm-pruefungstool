-- Übungsmodus: Prüfung dauerhaft offen, jeder Beitritt ist ein neuer Versuch,
-- Timer pro Versuch (gestartet_am + Dauer). Für Demo/Selbsttest.
alter table public.pruefung add column if not exists uebungsmodus boolean not null default false;

-- Beitreten: im Übungsmodus immer erlaubt + jedes Mal neuer Teilnehmer (Versuch)
create or replace function public.pruefung_beitreten(p_code text, p_name text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_pr public.pruefung%rowtype;
  v_tn public.teilnehmer%rowtype;
begin
  if v_uid is null then raise exception 'Nicht angemeldet.'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'Bitte einen Namen eingeben.'; end if;
  select * into v_pr from public.pruefung where zugangscode = p_code;
  if not found then raise exception 'Zugangscode ungültig.'; end if;

  if v_pr.uebungsmodus then
    insert into public.teilnehmer (pruefung_id, auth_user_id, name)
      values (v_pr.id, v_uid, trim(p_name)) returning * into v_tn;
    return jsonb_build_object('teilnehmer_id', v_tn.id, 'name', v_tn.name, 'status', v_pr.status, 'abgegeben', false);
  end if;

  if v_pr.status = 'entwurf' then raise exception 'Die Prüfung ist noch nicht geöffnet.'; end if;
  select * into v_tn from public.teilnehmer where pruefung_id = v_pr.id and auth_user_id = v_uid;
  if not found then
    if v_pr.status = 'beendet' then raise exception 'Die Prüfung ist bereits beendet.'; end if;
    if v_pr.status = 'laeuft' and v_pr.late_join_modus = 'gesperrt' then
      raise exception 'Die Prüfung läuft bereits. Bitte wende dich an deinen Trainer.';
    end if;
    insert into public.teilnehmer (pruefung_id, auth_user_id, name)
      values (v_pr.id, v_uid, trim(p_name)) returning * into v_tn;
  end if;
  return jsonb_build_object('teilnehmer_id', v_tn.id, 'name', v_tn.name, 'status', v_pr.status, 'abgegeben', v_tn.abgegeben_am is not null);
end; $$;

-- Status: gibt zusätzlich uebungsmodus zurück
create or replace function public.pruefung_status(p_code text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_pr public.pruefung%rowtype;
  v_name text; v_kurs text; v_dauer int;
begin
  select * into v_pr from public.pruefung where zugangscode = p_code;
  if not found then raise exception 'Zugangscode ungültig.'; end if;
  select pv.name, k.name, pv.dauer_minuten into v_name, v_kurs, v_dauer
    from public.pruefungsvorlage pv join public.kurs k on k.id = pv.kurs_id
    where pv.id = v_pr.vorlage_id;
  return jsonb_build_object(
    'status', v_pr.status, 'start_zeit', v_pr.start_zeit, 'end_zeit', v_pr.end_zeit,
    'late_join_modus', v_pr.late_join_modus, 'dauer_minuten', v_dauer,
    'vorlage_name', v_name, 'kurs_name', v_kurs, 'uebungsmodus', v_pr.uebungsmodus
  );
end; $$;

-- Fragen: im Übungsmodus unabhängig vom Status; persönliches Ende = gestartet_am + Dauer
create or replace function public.pruefung_fragen(p_teilnehmer_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_tn public.teilnehmer%rowtype;
  v_pr public.pruefung%rowtype;
  v_fragen jsonb; v_antworten jsonb; v_personal_end timestamptz; v_dauer int;
begin
  select * into v_tn from public.teilnehmer where id = p_teilnehmer_id and auth_user_id = v_uid;
  if not found then raise exception 'Kein Zugriff.'; end if;
  select * into v_pr from public.pruefung where id = v_tn.pruefung_id;
  if not v_pr.uebungsmodus and v_pr.status not in ('laeuft', 'beendet') then
    raise exception 'Die Prüfung läuft nicht.';
  end if;

  if v_tn.gestartet_am is null and (v_pr.uebungsmodus or v_pr.status = 'laeuft') then
    update public.teilnehmer set gestartet_am = now() where id = v_tn.id
      returning gestartet_am into v_tn.gestartet_am;
  end if;

  select jsonb_agg(jsonb_build_object(
      'pruefung_frage_id', pf.id, 'sortierung', pf.sortierung, 'typ', f.typ, 'text', f.text,
      'themengebiet', tg.name,
      'optionen', (select jsonb_agg(jsonb_build_object('id', ao.id, 'text', ao.text) order by ao.sortierung)
                   from public.antwortoption ao where ao.frage_id = f.id)
    ) order by pf.sortierung)
  into v_fragen
  from public.pruefung_frage pf
    join public.frage f on f.id = pf.frage_id
    left join public.themengebiet tg on tg.id = pf.themengebiet_id
  where pf.pruefung_id = v_pr.id;

  select jsonb_agg(jsonb_build_object('pruefung_frage_id', a.pruefung_frage_id, 'optionen', a.ausgewaehlte_optionen, 'unsicher', a.unsicher_markiert))
  into v_antworten from public.antwort a where a.teilnehmer_id = v_tn.id;

  select dauer_minuten into v_dauer from public.pruefungsvorlage where id = v_pr.vorlage_id;
  v_personal_end := case
    when (v_pr.uebungsmodus or v_pr.late_join_modus = 'volle_zeit') and v_tn.gestartet_am is not null
      then v_tn.gestartet_am + make_interval(mins => v_dauer)
    else v_pr.end_zeit end;

  return jsonb_build_object('status', v_pr.status, 'end_zeit', v_personal_end,
    'abgegeben', v_tn.abgegeben_am is not null,
    'fragen', coalesce(v_fragen, '[]'::jsonb), 'antworten', coalesce(v_antworten, '[]'::jsonb));
end; $$;

-- Antwort speichern: im Übungsmodus unabhängig vom Status
create or replace function public.antwort_speichern(
  p_teilnehmer_id uuid, p_pruefung_frage_id uuid, p_optionen uuid[], p_unsicher boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_tn public.teilnehmer%rowtype;
  v_status text; v_uebung boolean; v_pf_pruefung uuid;
begin
  select * into v_tn from public.teilnehmer where id = p_teilnehmer_id and auth_user_id = v_uid;
  if not found then raise exception 'Kein Zugriff.'; end if;
  if v_tn.abgegeben_am is not null then raise exception 'Bereits abgegeben.'; end if;
  select status, uebungsmodus into v_status, v_uebung from public.pruefung where id = v_tn.pruefung_id;
  if not v_uebung and v_status <> 'laeuft' then raise exception 'Die Prüfung läuft nicht.'; end if;
  select pruefung_id into v_pf_pruefung from public.pruefung_frage where id = p_pruefung_frage_id;
  if v_pf_pruefung is distinct from v_tn.pruefung_id then raise exception 'Ungültige Frage.'; end if;
  if v_tn.gestartet_am is null then update public.teilnehmer set gestartet_am = now() where id = v_tn.id; end if;

  insert into public.antwort (teilnehmer_id, pruefung_frage_id, ausgewaehlte_optionen, unsicher_markiert, zuletzt_geaendert)
    values (v_tn.id, p_pruefung_frage_id, coalesce(p_optionen, '{}'), coalesce(p_unsicher, false), now())
  on conflict (teilnehmer_id, pruefung_frage_id) do update
    set ausgewaehlte_optionen = excluded.ausgewaehlte_optionen, unsicher_markiert = excluded.unsicher_markiert, zuletzt_geaendert = now();
end; $$;

-- Abgeben: im Übungsmodus unabhängig vom Status
create or replace function public.pruefung_abgeben(p_teilnehmer_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_tn public.teilnehmer%rowtype;
  v_status text; v_uebung boolean;
  v_total numeric := 0; v_max numeric := 0; v_prozent numeric;
  rec record; v_selected uuid[]; v_n int; v_correct int;
begin
  select * into v_tn from public.teilnehmer where id = p_teilnehmer_id and auth_user_id = v_uid;
  if not found then raise exception 'Kein Zugriff.'; end if;
  if v_tn.abgegeben_am is not null then
    return jsonb_build_object('punkte_gesamt', v_tn.punkte_gesamt, 'punkte_max', v_tn.punkte_max, 'prozent', v_tn.prozent);
  end if;
  select status, uebungsmodus into v_status, v_uebung from public.pruefung where id = v_tn.pruefung_id;
  if not v_uebung and v_status not in ('laeuft', 'beendet') then raise exception 'Abgabe nicht möglich.'; end if;

  for rec in
    select pf.id as pf_id, pf.frage_id, f.typ
    from public.pruefung_frage pf join public.frage f on f.id = pf.frage_id
    where pf.pruefung_id = v_tn.pruefung_id
  loop
    select ausgewaehlte_optionen into v_selected from public.antwort where teilnehmer_id = v_tn.id and pruefung_frage_id = rec.pf_id;
    if v_selected is null then v_selected := '{}'; end if;
    v_n := coalesce(array_length(v_selected, 1), 0);
    select count(*) into v_correct from public.antwortoption where frage_id = rec.frage_id and ist_richtig and id = any(v_selected);
    if rec.typ = 'single' then
      v_max := v_max + 1;
      if v_n = 1 and v_correct = 1 then v_total := v_total + 1; end if;
    else
      v_max := v_max + 2;
      if v_n between 1 and 2 then v_total := v_total + v_correct; end if;
    end if;
  end loop;

  v_prozent := case when v_max > 0 then round(100.0 * v_total / v_max, 2) else 0 end;
  update public.teilnehmer set abgegeben_am = now(), punkte_gesamt = v_total, punkte_max = v_max, prozent = v_prozent where id = v_tn.id;
  return jsonb_build_object('punkte_gesamt', v_total, 'punkte_max', v_max, 'prozent', v_prozent);
end; $$;
