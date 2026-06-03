-- Kurs
create table public.kurs (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references public.trainer (id) on delete cascade,
  name         text not null,
  beschreibung text,
  created_at   timestamptz not null default now()
);
create index kurs_owner_id_idx on public.kurs (owner_id);

-- Themengebiet (z.B. "Rechtliche Grundlagen")
create table public.themengebiet (
  id         uuid primary key default gen_random_uuid(),
  kurs_id    uuid not null references public.kurs (id) on delete cascade,
  name       text not null,
  sortierung int not null default 0,
  created_at timestamptz not null default now()
);
create index themengebiet_kurs_id_idx on public.themengebiet (kurs_id);

-- Frage
create table public.frage (
  id              uuid primary key default gen_random_uuid(),
  kurs_id         uuid not null references public.kurs (id) on delete cascade,
  themengebiet_id uuid references public.themengebiet (id) on delete set null,
  text            text not null,
  typ             text not null check (typ in ('single', 'multi')),
  erstellt_am     timestamptz not null default now()
);
create index frage_kurs_id_idx on public.frage (kurs_id);
create index frage_themengebiet_id_idx on public.frage (themengebiet_id);

comment on column public.frage.typ is 'single = 1 richtige Antwort (max 1 Punkt); multi = 2 richtige Antworten (max 2 Punkte)';

-- Antwortoption
create table public.antwortoption (
  id          uuid primary key default gen_random_uuid(),
  frage_id    uuid not null references public.frage (id) on delete cascade,
  text        text not null,
  ist_richtig boolean not null default false,
  sortierung  int not null default 0
);
create index antwortoption_frage_id_idx on public.antwortoption (frage_id);
