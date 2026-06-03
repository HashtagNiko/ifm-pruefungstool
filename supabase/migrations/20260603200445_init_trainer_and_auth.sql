-- Extensions
create extension if not exists pgcrypto;

-- Trainer-Konto (1:1 zu auth.users)
create table public.trainer (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text,
  name       text,
  created_at timestamptz not null default now()
);

comment on table public.trainer is 'Trainer-Konto, 1:1 verknuepft mit auth.users. Teilnehmer haben KEIN trainer-Row.';

-- Auto-Anlage eines trainer-Rows bei Registrierung.
-- Anonyme Logins (spaeter fuer Teilnehmer) werden uebersprungen.
create or replace function public.handle_new_trainer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(new.is_anonymous, false) then
    return new;
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

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_trainer();
