-- Pro Kurs konfigurierbare Obergrenze richtiger Antworten bei Multi-Choice-Fragen.
-- Standard 2 (bisheriges Verhalten); einzelne Kurse dürfen mehr (z. B. 3).
alter table public.kurs
  add column multi_max_richtig smallint not null default 2
  check (multi_max_richtig between 2 and 6);

-- WEG-Projekttag 2: bis zu 3 richtige Antworten erlaubt
update public.kurs set multi_max_richtig = 3
  where id = 'b302c6f5-3827-4fb6-8ccc-a4e747c27633';

-- Punkteberechnung generalisieren: max. Punkte einer Multi-Frage = Anzahl richtiger
-- Optionen der Frage; über dieser Anzahl angekreuzt -> 0 Punkte (bisher fix 2 verdrahtet).
-- Für Fragen mit genau 2 richtigen Optionen bleibt das Ergebnis unveraendert.
create or replace function public.pruefung_abgeben(p_teilnehmer_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_tn public.teilnehmer%rowtype;
  v_status text; v_uebung boolean;
  v_total numeric := 0; v_max numeric := 0; v_prozent numeric;
  rec record; v_selected uuid[]; v_n int; v_correct int; v_kmax int;
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
      select count(*) into v_kmax from public.antwortoption where frage_id = rec.frage_id and ist_richtig;
      if v_kmax < 1 then v_kmax := 2; end if;
      v_max := v_max + v_kmax;
      if v_n between 1 and v_kmax then v_total := v_total + v_correct; end if;
    end if;
  end loop;

  v_prozent := case when v_max > 0 then round(100.0 * v_total / v_max, 2) else 0 end;
  update public.teilnehmer set abgegeben_am = now(), punkte_gesamt = v_total, punkte_max = v_max, prozent = v_prozent where id = v_tn.id;
  return jsonb_build_object('punkte_gesamt', v_total, 'punkte_max', v_max, 'prozent', v_prozent);
end; $$;
