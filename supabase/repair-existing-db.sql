-- Run this once in Supabase if the existing project only has the 3 base columns
-- on public.allowed_users. It is safe to run multiple times.

alter table public.allowed_users
  add column if not exists accent text not null default '#72d4ff';
alter table public.allowed_users
  add column if not exists avatar_url text not null default '';
alter table public.allowed_users
  add column if not exists updated_at timestamptz not null default now();
alter table public.allowed_users
  add column if not exists last_online_at timestamptz;
alter table public.allowed_users
  add column if not exists bio text not null default '';
alter table public.allowed_users
  add column if not exists status_message text not null default '';
alter table public.allowed_users
  add column if not exists email_mfa_enabled boolean not null default true;
alter table public.allowed_users
  add column if not exists theme_mode text not null default 'system';
alter table public.allowed_users
  drop column if exists do_not_disturb;

update public.allowed_users
set
  accent = coalesce(accent, '#72d4ff'),
  avatar_url = coalesce(avatar_url, ''),
  updated_at = coalesce(updated_at, now()),
  last_online_at = last_online_at,
  bio = coalesce(bio, ''),
  status_message = coalesce(status_message, ''),
  email_mfa_enabled = coalesce(email_mfa_enabled, true),
  theme_mode = coalesce(theme_mode, 'system');

create or replace function public.touch_allowed_users_updated_at()
returns trigger
language plpgsql
as $$
begin
  if new.last_online_at is distinct from old.last_online_at
    and new.accent is not distinct from old.accent
    and new.avatar_url is not distinct from old.avatar_url
    and new.bio is not distinct from old.bio
    and new.status_message is not distinct from old.status_message
    and new.email_mfa_enabled is not distinct from old.email_mfa_enabled
    and new.theme_mode is not distinct from old.theme_mode
  then
    new.updated_at = old.updated_at;
  else
    new.updated_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists allowed_users_touch_updated_at on public.allowed_users;
create trigger allowed_users_touch_updated_at
before update on public.allowed_users
for each row
execute function public.touch_allowed_users_updated_at();

alter table public.songs
  add column if not exists status text not null default 'concept';

update public.songs
set status = coalesce(status, 'concept');

create table if not exists public.app_build_state (
  id text primary key default 'current',
  build_number text not null default '2.2.0',
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.app_build_state
  add column if not exists build_number text not null default '2.2.0';
alter table public.app_build_state
  add column if not exists published_at timestamptz not null default now();
alter table public.app_build_state
  add column if not exists created_at timestamptz not null default now();
alter table public.app_build_state
  add column if not exists updated_at timestamptz not null default now();

grant select on table public.app_build_state to anon;
grant select on table public.app_build_state to authenticated;
grant insert, update on table public.app_build_state to authenticated;

alter table public.app_build_state enable row level security;

drop policy if exists "Anyone can read app build state" on public.app_build_state;
create policy "Anyone can read app build state"
  on public.app_build_state
  for select
  to public
  using (true);

drop policy if exists "Mattiz can publish app build state" on public.app_build_state;
create policy "Mattiz can publish app build state"
  on public.app_build_state
  for insert
  to authenticated
  with check (public.is_allowed_yowl_user() and lower(public.current_allowed_username()) = 'mattiz');

drop policy if exists "Mattiz can update app build state" on public.app_build_state;
create policy "Mattiz can update app build state"
  on public.app_build_state
  for update
  to authenticated
  using (public.is_allowed_yowl_user() and lower(public.current_allowed_username()) = 'mattiz')
  with check (public.is_allowed_yowl_user() and lower(public.current_allowed_username()) = 'mattiz');

insert into public.app_build_state (id, build_number)
values ('current', '2.2.0')
on conflict (id) do update
set build_number = coalesce(public.app_build_state.build_number, excluded.build_number),
    updated_at = now();

create or replace function public.touch_app_build_state_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists app_build_state_touch_updated_at on public.app_build_state;
create trigger app_build_state_touch_updated_at
before update on public.app_build_state
for each row
execute function public.touch_app_build_state_updated_at();

do $$
begin
  alter publication supabase_realtime add table public.app_build_state;
exception
  when duplicate_object then null;
end $$;

alter table public.messages
  add column if not exists reply_to_message_id uuid;
alter table public.messages
  add column if not exists reply_to_sender text;
alter table public.messages
  add column if not exists reply_to_body text;
alter table public.messages
  add column if not exists reply_to_created_at timestamptz;


NOTIFY pgrst, 'reload schema';
