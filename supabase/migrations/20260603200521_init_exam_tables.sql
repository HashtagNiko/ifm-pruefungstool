-- Pruefungsvorlage (einmalig pro Pruefungstyp, z.B. "WEG-IHK-Standard")
create table public.pruefungsvorlage (
  id                                          uuid primary key default gen_random_uuid(),
  kurs_id                                     uuid not null references public.kurs (id) on delete cascade,
  name                                        text not null,
  dauer_minuten                               int not null,
  bestehensschwelle_prozent                   numeric(5,2) not null default 50,
  bestehensschwelle_pro_themengebiet_prozent  numeric(5,2),
  created_at                                  timestamptz not null default now()
);
create index pruefungsvorlage_kurs_id_idx on public.pruefungsvorlage (kurs_id);

-- Pro Vorlage: je Themengebiet Frageanzahl + Punktegewicht
create table public.vorlage_themengebiet (
  id              uuid primary key default gen_random_uuid(),
  vorlage_id      uuid not null references public.pruefungsvorlage (id) on delete cascade,
  themengebiet_id uuid not null references public.themengebiet (id) on delete cascade,
  anzahl_fragen   int not null check (anzahl_fragen >= 0),
  punkte_gesamt   int not null check (punkte_gesamt >= 0)
);
create index vorlage_themengebiet_vorlage_id_idx on public.vorlage_themengebiet (vorlage_id);
create index vorlage_themengebiet_themengebiet_id_idx on public.vorlage_themengebiet (themengebiet_id);

-- Konkrete Pruefung (Sitzung)
create table public.pruefung (
  id              uuid primary key default gen_random_uuid(),
  vorlage_id      uuid not null references public.pruefungsvorlage (id) on delete restrict,
  owner_id        uuid not null references public.trainer (id) on delete cascade,
  datum           date,
  status          text not null default 'entwurf'
                    check (status in ('entwurf', 'lobby', 'laeuft', 'beendet')),
  start_zeit      timestamptz,
  end_zeit        timestamptz,
  late_join_modus text not null default 'zeit_reduziert'
                    check (late_join_modus in ('zeit_reduziert', 'volle_zeit', 'gesperrt')),
  zugangscode     text not null unique default encode(gen_random_bytes(8), 'hex'),
  created_at      timestamptz not null default now()
);
create index pruefung_owner_id_idx on public.pruefung (owner_id);
create index pruefung_vorlage_id_idx on public.pruefung (vorlage_id);

comment on column public.pruefung.zugangscode is 'Eindeutiger Code fuer den Teilnehmer-Link, z.B. /p/<zugangscode>';

-- Fragen-Snapshot: bei Pruefungsstart fixierte Fragenauswahl
-- (referenziert frage; on delete restrict schuetzt Fragen, die in einer Pruefung verwendet werden)
create table public.pruefung_frage (
  id              uuid primary key default gen_random_uuid(),
  pruefung_id     uuid not null references public.pruefung (id) on delete cascade,
  frage_id        uuid not null references public.frage (id) on delete restrict,
  themengebiet_id uuid references public.themengebiet (id) on delete set null,
  sortierung      int not null default 0,
  unique (pruefung_id, frage_id)
);
create index pruefung_frage_pruefung_id_idx on public.pruefung_frage (pruefung_id);
create index pruefung_frage_frage_id_idx on public.pruefung_frage (frage_id);

-- Teilnehmer (kein Konto; optional spaeter via anonymem Auth-User verknuepft)
create table public.teilnehmer (
  id              uuid primary key default gen_random_uuid(),
  pruefung_id     uuid not null references public.pruefung (id) on delete cascade,
  auth_user_id    uuid references auth.users (id) on delete set null,
  name            text not null,
  gestartet_am    timestamptz,
  abgegeben_am    timestamptz,
  punkte_gesamt   numeric(7,2),
  punkte_max      numeric(7,2),
  prozent         numeric(5,2),
  anonymisiert_am timestamptz,
  created_at      timestamptz not null default now()
);
create index teilnehmer_pruefung_id_idx on public.teilnehmer (pruefung_id);
create index teilnehmer_auth_user_id_idx on public.teilnehmer (auth_user_id);

comment on column public.teilnehmer.anonymisiert_am is '7-Tage-Regel: nach Anonymisierung wird name durch "Anonymisiert" ersetzt, Punkte bleiben.';

-- Antwort (Auto-Save in Echtzeit)
create table public.antwort (
  id                   uuid primary key default gen_random_uuid(),
  teilnehmer_id        uuid not null references public.teilnehmer (id) on delete cascade,
  pruefung_frage_id    uuid not null references public.pruefung_frage (id) on delete cascade,
  ausgewaehlte_optionen uuid[] not null default '{}',
  unsicher_markiert    boolean not null default false,
  zuletzt_geaendert    timestamptz not null default now(),
  unique (teilnehmer_id, pruefung_frage_id)
);
create index antwort_teilnehmer_id_idx on public.antwort (teilnehmer_id);
create index antwort_pruefung_frage_id_idx on public.antwort (pruefung_frage_id);

comment on column public.antwort.ausgewaehlte_optionen is 'Array von antwortoption.id; Punkte werden serverseitig (Edge-Function) berechnet.';

-- Trainer-Feedback auf drei Ebenen
create table public.feedback (
  id            uuid primary key default gen_random_uuid(),
  teilnehmer_id uuid not null references public.teilnehmer (id) on delete cascade,
  ebene         text not null check (ebene in ('frage', 'themengebiet', 'gesamt')),
  bezug_id      uuid,
  text          text not null,
  created_at    timestamptz not null default now()
);
create index feedback_teilnehmer_id_idx on public.feedback (teilnehmer_id);

comment on column public.feedback.bezug_id is 'Bei ebene=frage -> frage.id; ebene=themengebiet -> themengebiet.id; ebene=gesamt -> null. Polymorph, daher kein FK.';
