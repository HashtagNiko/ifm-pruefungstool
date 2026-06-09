-- Kurs-Freigaben (Sharing). Geteilt wird auf Kurs-Ebene (Pool + Vorlagen hängen daran).
create table public.kurs_freigabe (
  id               uuid primary key default gen_random_uuid(),
  kurs_id          uuid not null references public.kurs (id) on delete cascade,
  besitzer_id      uuid not null references public.trainer (id) on delete cascade,
  besitzer_email   text,
  kurs_name        text not null,
  empfaenger_email text not null,
  empfaenger_id    uuid references public.trainer (id) on delete set null,
  modus            text not null check (modus in ('nur_verwenden', 'gemeinsam', 'kopie')),
  status           text not null default 'eingeladen'
                     check (status in ('eingeladen', 'angenommen', 'abgelehnt')),
  created_at       timestamptz not null default now(),
  unique (kurs_id, empfaenger_email)
);
create index kurs_freigabe_kurs_id_idx on public.kurs_freigabe (kurs_id);
create index kurs_freigabe_besitzer_id_idx on public.kurs_freigabe (besitzer_id);
create index kurs_freigabe_empfaenger_id_idx on public.kurs_freigabe (empfaenger_id);
create index kurs_freigabe_empfaenger_email_idx on public.kurs_freigabe (lower(empfaenger_email));

-- ===== Rechte-Helfer (SECURITY DEFINER, um RLS-Rekursion zu vermeiden) =====
create or replace function public.darf_kurs_lesen(p_kurs_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.kurs k where k.id = p_kurs_id and k.owner_id = auth.uid())
      or exists (
        select 1 from public.kurs_freigabe f
        where f.kurs_id = p_kurs_id
          and f.status = 'angenommen'
          and f.modus in ('gemeinsam', 'nur_verwenden')
          and f.empfaenger_id = auth.uid()
      );
$$;

create or replace function public.darf_kurs_bearbeiten(p_kurs_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.kurs k where k.id = p_kurs_id and k.owner_id = auth.uid())
      or exists (
        select 1 from public.kurs_freigabe f
        where f.kurs_id = p_kurs_id
          and f.status = 'angenommen'
          and f.modus = 'gemeinsam'
          and f.empfaenger_id = auth.uid()
      );
$$;

grant execute on function public.darf_kurs_lesen(uuid) to authenticated;
grant execute on function public.darf_kurs_bearbeiten(uuid) to authenticated;

-- ===== RLS für kurs_freigabe =====
alter table public.kurs_freigabe enable row level security;

create policy "freigabe_besitzer" on public.kurs_freigabe
  for all to authenticated
  using (besitzer_id = (select auth.uid()))
  with check (besitzer_id = (select auth.uid()));

create policy "freigabe_empfaenger_select" on public.kurs_freigabe
  for select to authenticated
  using (
    lower(empfaenger_email) = lower((select t.email from public.trainer t where t.id = (select auth.uid())))
  );

-- ===== Inhalts-Policies auf Freigabe-Logik umstellen =====
drop policy "kurs_all_own" on public.kurs;
create policy "kurs_select" on public.kurs
  for select to authenticated using (public.darf_kurs_lesen(id));
create policy "kurs_insert" on public.kurs
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "kurs_update" on public.kurs
  for update to authenticated
  using (public.darf_kurs_bearbeiten(id))
  with check (public.darf_kurs_bearbeiten(id));
create policy "kurs_delete" on public.kurs
  for delete to authenticated using (owner_id = (select auth.uid()));

drop policy "themengebiet_all_own" on public.themengebiet;
create policy "themengebiet_lesen" on public.themengebiet
  for select to authenticated using (public.darf_kurs_lesen(kurs_id));
create policy "themengebiet_bearbeiten" on public.themengebiet
  for all to authenticated
  using (public.darf_kurs_bearbeiten(kurs_id))
  with check (public.darf_kurs_bearbeiten(kurs_id));

drop policy "frage_all_own" on public.frage;
create policy "frage_lesen" on public.frage
  for select to authenticated using (public.darf_kurs_lesen(kurs_id));
create policy "frage_bearbeiten" on public.frage
  for all to authenticated
  using (public.darf_kurs_bearbeiten(kurs_id))
  with check (public.darf_kurs_bearbeiten(kurs_id));

drop policy "antwortoption_all_own" on public.antwortoption;
create policy "antwortoption_lesen" on public.antwortoption
  for select to authenticated
  using (public.darf_kurs_lesen((select f.kurs_id from public.frage f where f.id = antwortoption.frage_id)));
create policy "antwortoption_bearbeiten" on public.antwortoption
  for all to authenticated
  using (public.darf_kurs_bearbeiten((select f.kurs_id from public.frage f where f.id = antwortoption.frage_id)))
  with check (public.darf_kurs_bearbeiten((select f.kurs_id from public.frage f where f.id = antwortoption.frage_id)));

drop policy "pruefungsvorlage_all_own" on public.pruefungsvorlage;
create policy "pruefungsvorlage_lesen" on public.pruefungsvorlage
  for select to authenticated using (public.darf_kurs_lesen(kurs_id));
create policy "pruefungsvorlage_bearbeiten" on public.pruefungsvorlage
  for all to authenticated
  using (public.darf_kurs_bearbeiten(kurs_id))
  with check (public.darf_kurs_bearbeiten(kurs_id));

drop policy "vorlage_themengebiet_all_own" on public.vorlage_themengebiet;
create policy "vorlage_themengebiet_lesen" on public.vorlage_themengebiet
  for select to authenticated
  using (public.darf_kurs_lesen((select v.kurs_id from public.pruefungsvorlage v where v.id = vorlage_themengebiet.vorlage_id)));
create policy "vorlage_themengebiet_bearbeiten" on public.vorlage_themengebiet
  for all to authenticated
  using (public.darf_kurs_bearbeiten((select v.kurs_id from public.pruefungsvorlage v where v.id = vorlage_themengebiet.vorlage_id)))
  with check (public.darf_kurs_bearbeiten((select v.kurs_id from public.pruefungsvorlage v where v.id = vorlage_themengebiet.vorlage_id)));
