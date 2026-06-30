-- Empfänger einer geteilten Prüfung kann den kompletten Kurs (inkl. Pool, Vorlage,
-- dieser Prüfung) in sein Konto kopieren – unabhängig vom Freigabe-Modus.
create or replace function public.geteilte_pruefung_kurs_kopieren(p_freigabe_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_f public.pruefung_freigabe%rowtype;
  v_neu uuid;
begin
  select email into v_email from public.trainer where id = v_uid;
  select * into v_f from public.pruefung_freigabe where id = p_freigabe_id;
  if not found
     or lower(v_f.empfaenger_email) <> lower(coalesce(v_email, ''))
     or v_f.status <> 'angenommen' then
    raise exception 'Keine Berechtigung für diese Freigabe.';
  end if;
  v_neu := public.pruefung_klonen(v_f.pruefung_id);
  return v_neu;
end; $$;
grant execute on function public.geteilte_pruefung_kurs_kopieren(uuid) to authenticated;
