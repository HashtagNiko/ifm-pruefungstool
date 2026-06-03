-- RLS auf allen Tabellen aktivieren (Default ohne Policy = deny all)
alter table public.trainer              enable row level security;
alter table public.kurs                 enable row level security;
alter table public.themengebiet         enable row level security;
alter table public.frage                enable row level security;
alter table public.antwortoption        enable row level security;
alter table public.pruefungsvorlage     enable row level security;
alter table public.vorlage_themengebiet enable row level security;
alter table public.pruefung             enable row level security;
alter table public.pruefung_frage       enable row level security;
alter table public.teilnehmer           enable row level security;
alter table public.antwort              enable row level security;
alter table public.feedback             enable row level security;

-- ===== trainer: nur eigenes Konto =====
create policy "trainer_select_own" on public.trainer
  for select to authenticated
  using (id = (select auth.uid()));
create policy "trainer_insert_own" on public.trainer
  for insert to authenticated
  with check (id = (select auth.uid()));
create policy "trainer_update_own" on public.trainer
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- ===== kurs: nur Besitzer =====
create policy "kurs_all_own" on public.kurs
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- ===== themengebiet: ueber Kurs-Besitz =====
create policy "themengebiet_all_own" on public.themengebiet
  for all to authenticated
  using (exists (
    select 1 from public.kurs k
    where k.id = themengebiet.kurs_id and k.owner_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.kurs k
    where k.id = themengebiet.kurs_id and k.owner_id = (select auth.uid())
  ));

-- ===== frage: ueber Kurs-Besitz =====
create policy "frage_all_own" on public.frage
  for all to authenticated
  using (exists (
    select 1 from public.kurs k
    where k.id = frage.kurs_id and k.owner_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.kurs k
    where k.id = frage.kurs_id and k.owner_id = (select auth.uid())
  ));

-- ===== antwortoption: ueber frage -> kurs =====
create policy "antwortoption_all_own" on public.antwortoption
  for all to authenticated
  using (exists (
    select 1 from public.frage f
    join public.kurs k on k.id = f.kurs_id
    where f.id = antwortoption.frage_id and k.owner_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.frage f
    join public.kurs k on k.id = f.kurs_id
    where f.id = antwortoption.frage_id and k.owner_id = (select auth.uid())
  ));

-- ===== pruefungsvorlage: ueber Kurs-Besitz =====
create policy "pruefungsvorlage_all_own" on public.pruefungsvorlage
  for all to authenticated
  using (exists (
    select 1 from public.kurs k
    where k.id = pruefungsvorlage.kurs_id and k.owner_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.kurs k
    where k.id = pruefungsvorlage.kurs_id and k.owner_id = (select auth.uid())
  ));

-- ===== vorlage_themengebiet: ueber vorlage -> kurs =====
create policy "vorlage_themengebiet_all_own" on public.vorlage_themengebiet
  for all to authenticated
  using (exists (
    select 1 from public.pruefungsvorlage v
    join public.kurs k on k.id = v.kurs_id
    where v.id = vorlage_themengebiet.vorlage_id and k.owner_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.pruefungsvorlage v
    join public.kurs k on k.id = v.kurs_id
    where v.id = vorlage_themengebiet.vorlage_id and k.owner_id = (select auth.uid())
  ));

-- ===== pruefung: nur Besitzer =====
create policy "pruefung_all_own" on public.pruefung
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- ===== pruefung_frage: ueber pruefung-Besitz =====
create policy "pruefung_frage_all_own" on public.pruefung_frage
  for all to authenticated
  using (exists (
    select 1 from public.pruefung p
    where p.id = pruefung_frage.pruefung_id and p.owner_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.pruefung p
    where p.id = pruefung_frage.pruefung_id and p.owner_id = (select auth.uid())
  ));

-- ===== teilnehmer: Trainer der zugehoerigen Pruefung =====
create policy "teilnehmer_all_trainer" on public.teilnehmer
  for all to authenticated
  using (exists (
    select 1 from public.pruefung p
    where p.id = teilnehmer.pruefung_id and p.owner_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.pruefung p
    where p.id = teilnehmer.pruefung_id and p.owner_id = (select auth.uid())
  ));

-- ===== antwort: Trainer ueber teilnehmer -> pruefung (lesend) =====
create policy "antwort_select_trainer" on public.antwort
  for select to authenticated
  using (exists (
    select 1 from public.teilnehmer t
    join public.pruefung p on p.id = t.pruefung_id
    where t.id = antwort.teilnehmer_id and p.owner_id = (select auth.uid())
  ));

-- ===== feedback: Trainer ueber teilnehmer -> pruefung =====
create policy "feedback_all_trainer" on public.feedback
  for all to authenticated
  using (exists (
    select 1 from public.teilnehmer t
    join public.pruefung p on p.id = t.pruefung_id
    where t.id = feedback.teilnehmer_id and p.owner_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.teilnehmer t
    join public.pruefung p on p.id = t.pruefung_id
    where t.id = feedback.teilnehmer_id and p.owner_id = (select auth.uid())
  ));
