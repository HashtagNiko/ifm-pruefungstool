-- Empfänger einer geteilten Prüfung (eingeschraenkt/korrektur) darf den Kurs LESEN
-- (für die Anzeige des Kursnamens in Prüfungs-Liste/-Detail/-Auswertung).
-- Bearbeiten bleibt ausgeschlossen (kein darf_kurs_bearbeiten). In der "Kurse"-
-- Verwaltungsliste wird dieser Kurs clientseitig ausgeblendet (KursePage).
create or replace function public.darf_kurs_lesen_via_pruefung(p_kurs_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.pruefung_freigabe f
    join public.pruefung p on p.id = f.pruefung_id
    join public.pruefungsvorlage v on v.id = p.vorlage_id
    where v.kurs_id = p_kurs_id
      and f.empfaenger_id = auth.uid()
      and f.status = 'angenommen'
      and f.modus in ('eingeschraenkt', 'korrektur')
  );
$$;
grant execute on function public.darf_kurs_lesen_via_pruefung(uuid) to authenticated;

create policy "kurs_lesen_geteilte_pruefung" on public.kurs
  for select to authenticated
  using (public.darf_kurs_lesen_via_pruefung(id));
