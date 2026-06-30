-- Empfänger einer geteilten Prüfung darf den GANZEN Fragenpool + alle Themengebiete
-- des Kurses LESEN. Löschen = pro Trainer ausblenden (betrifft den Besitzer NIE).

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
      and f.modus in ('eingeschraenkt', 'korrektur')
      and fr.themengebiet_id = any (f.bearbeitbare_themengebiete)
  ) or exists (
    select 1 from public.pruefung_frage pf
    join public.pruefung_freigabe f on f.pruefung_id = pf.pruefung_id
    where pf.frage_id = p_frage_id
      and f.empfaenger_id = auth.uid()
      and f.status = 'angenommen'
      and f.modus = 'korrektur'
  ) or exists (
    -- ganzer Pool des Kurses einer mir geteilten Prüfung (nur lesen)
    select 1 from public.pruefung_freigabe f
    join public.pruefung p on p.id = f.pruefung_id
    join public.pruefungsvorlage v on v.id = p.vorlage_id
    join public.frage fr on fr.id = p_frage_id
    where f.empfaenger_id = auth.uid()
      and f.status = 'angenommen'
      and f.modus in ('eingeschraenkt', 'korrektur')
      and fr.kurs_id = v.kurs_id
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
  ) or exists (
    -- alle Themengebiete des Kurses einer mir geteilten Prüfung
    select 1 from public.pruefung_freigabe f
    join public.pruefung p on p.id = f.pruefung_id
    join public.pruefungsvorlage v on v.id = p.vorlage_id
    join public.themengebiet tg on tg.id = p_tg_id
    where f.empfaenger_id = auth.uid()
      and f.status = 'angenommen'
      and f.modus in ('eingeschraenkt', 'korrektur')
      and tg.kurs_id = v.kurs_id
  );
$$;

create or replace function public.darf_frage_ausblenden(p_frage_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.frage fr
    where fr.id = p_frage_id
      and public.darf_frage_anlegen_geteilt(fr.kurs_id, fr.themengebiet_id)
  );
$$;
grant execute on function public.darf_frage_ausblenden(uuid) to authenticated;

create table public.frage_ausgeblendet (
  trainer_id uuid not null references public.trainer (id) on delete cascade,
  frage_id   uuid not null references public.frage (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (trainer_id, frage_id)
);
alter table public.frage_ausgeblendet enable row level security;

create policy "frage_ausgeblendet_lesen" on public.frage_ausgeblendet
  for select to authenticated
  using (trainer_id = (select auth.uid()));

create policy "frage_ausgeblendet_anlegen" on public.frage_ausgeblendet
  for insert to authenticated
  with check (trainer_id = (select auth.uid()) and public.darf_frage_ausblenden(frage_id));

create policy "frage_ausgeblendet_loeschen" on public.frage_ausgeblendet
  for delete to authenticated
  using (trainer_id = (select auth.uid()));
