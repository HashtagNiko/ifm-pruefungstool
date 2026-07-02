-- Teilnehmer-Fragen liefern jetzt die Anzahl richtiger Antworten je Frage mit,
-- damit der Hinweis ("x Antworten richtig") korrekt statt fix "2" angezeigt wird.
-- (Das Lösungs-Flag ist_richtig selbst wird weiterhin NICHT ausgeliefert.)
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
      'richtige_anzahl', (select count(*) from public.antwortoption ao where ao.frage_id = f.id and ao.ist_richtig),
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
