-- Pro Prüfung: Teilnehmer sehen nach Abgabe das Detailergebnis (richtig/falsch je Frage)
-- und können die Prüfung wiederholen. Standard aus; für Selbsttest/Übung sinnvoll.
alter table public.pruefung
  add column ergebnis_detail_sichtbar boolean not null default false;

-- Status um das neue Flag ergänzen (Teilnehmer-Client entscheidet Anzeige darüber).
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
    'vorlage_name', v_name, 'kurs_name', v_kurs, 'uebungsmodus', v_pr.uebungsmodus,
    'ergebnis_detail_sichtbar', v_pr.ergebnis_detail_sichtbar
  );
end; $$;

-- Detailergebnis eines abgegebenen Versuchs (inkl. Lösungs-Flag) – nur wenn freigegeben.
create or replace function public.pruefung_ergebnis_detail(p_teilnehmer_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_tn public.teilnehmer%rowtype;
  v_pr public.pruefung%rowtype;
  v_fragen jsonb;
begin
  select * into v_tn from public.teilnehmer where id = p_teilnehmer_id and auth_user_id = v_uid;
  if not found then raise exception 'Kein Zugriff.'; end if;
  if v_tn.abgegeben_am is null then raise exception 'Noch nicht abgegeben.'; end if;
  select * into v_pr from public.pruefung where id = v_tn.pruefung_id;
  if not v_pr.ergebnis_detail_sichtbar then raise exception 'Detailergebnis nicht freigegeben.'; end if;

  select jsonb_agg(jsonb_build_object(
      'pruefung_frage_id', pf.id,
      'sortierung', pf.sortierung,
      'typ', f.typ,
      'text', f.text,
      'themengebiet', tg.name,
      'optionen', (
        select jsonb_agg(jsonb_build_object('id', ao.id, 'text', ao.text, 'ist_richtig', ao.ist_richtig) order by ao.sortierung)
        from public.antwortoption ao where ao.frage_id = f.id
      ),
      'gewaehlt', coalesce((
        select a.ausgewaehlte_optionen from public.antwort a
        where a.teilnehmer_id = v_tn.id and a.pruefung_frage_id = pf.id
      ), '{}'::uuid[])
    ) order by pf.sortierung)
  into v_fragen
  from public.pruefung_frage pf
    join public.frage f on f.id = pf.frage_id
    left join public.themengebiet tg on tg.id = pf.themengebiet_id
  where pf.pruefung_id = v_pr.id;

  return jsonb_build_object(
    'punkte_gesamt', v_tn.punkte_gesamt,
    'punkte_max', v_tn.punkte_max,
    'prozent', v_tn.prozent,
    'fragen', coalesce(v_fragen, '[]'::jsonb)
  );
end; $$;

-- Neuer Versuch (Wiederholen): legt einen frischen Teilnehmer-Eintrag an (jeder Versuch zählt).
create or replace function public.pruefung_neuer_versuch(p_teilnehmer_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_tn public.teilnehmer%rowtype;
  v_pr public.pruefung%rowtype;
  v_neu public.teilnehmer%rowtype;
begin
  select * into v_tn from public.teilnehmer where id = p_teilnehmer_id and auth_user_id = v_uid;
  if not found then raise exception 'Kein Zugriff.'; end if;
  select * into v_pr from public.pruefung where id = v_tn.pruefung_id;
  if not (v_pr.uebungsmodus or v_pr.ergebnis_detail_sichtbar) then
    raise exception 'Wiederholen ist für diese Prüfung nicht erlaubt.';
  end if;
  insert into public.teilnehmer (pruefung_id, auth_user_id, name)
    values (v_pr.id, v_uid, v_tn.name) returning * into v_neu;
  return jsonb_build_object('teilnehmer_id', v_neu.id, 'name', v_neu.name);
end; $$;

grant execute on function public.pruefung_ergebnis_detail(uuid) to anon, authenticated;
grant execute on function public.pruefung_neuer_versuch(uuid) to anon, authenticated;

-- Für die bestehende Übungsprüfung des Kurses WEG-Projekttag 2 direkt aktivieren.
update public.pruefung set ergebnis_detail_sichtbar = true
  where id = 'c1667466-6e4b-42a4-b0ab-58433246ba4a';
