-- Freigabeliste: nur diese E-Mails dürfen Trainer-Accounts werden.
-- Verwaltung durch Admin (Supabase-Dashboard/SQL; service_role umgeht RLS).
create table public.eingeladene_trainer (
  email         text primary key,
  eingeladen_am timestamptz not null default now()
);
alter table public.eingeladene_trainer enable row level security;
-- bewusst keine Policies: kein Zugriff für anon/authenticated, nur Admin via Dashboard

comment on table public.eingeladene_trainer is 'Allowlist: erlaubte Trainer-E-Mails. Vor dem Anlegen eines Trainer-Accounts hier eintragen.';

-- bestehende Trainer in die Allowlist übernehmen
insert into public.eingeladene_trainer (email)
  select email from public.trainer where email is not null
  on conflict (email) do nothing;

-- Trigger-Funktion: anonyme Logins überspringen, sonst nur eingeladene E-Mails zulassen
create or replace function public.handle_new_trainer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(new.is_anonymous, false) then
    return new; -- Teilnehmer (anonym) -> kein Trainer
  end if;

  if new.email is null or not exists (
    select 1 from public.eingeladene_trainer e where lower(e.email) = lower(new.email)
  ) then
    raise exception 'Registrierung nur für eingeladene Trainer möglich.';
  end if;

  insert into public.trainer (id, email, name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', new.email)
  )
  on conflict (id) do nothing;

  return new;
end;
$$;
