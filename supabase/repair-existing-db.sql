-- Run this once in Supabase if the existing project only has the 3 base columns
-- on public.allowed_users. It is safe to run multiple times.

alter table public.allowed_users
  add column if not exists accent text not null default '#72d4ff';
alter table public.allowed_users
  add column if not exists avatar_url text not null default '';
alter table public.allowed_users
  add column if not exists updated_at timestamptz not null default now();
alter table public.allowed_users
  add column if not exists bio text not null default '';
alter table public.allowed_users
  add column if not exists status_message text not null default '';
alter table public.allowed_users
  drop column if exists do_not_disturb;

update public.allowed_users
set
  accent = coalesce(accent, '#72d4ff'),
  avatar_url = coalesce(avatar_url, ''),
  updated_at = coalesce(updated_at, now()),
  bio = coalesce(bio, ''),
  status_message = coalesce(status_message, '');

create or replace function public.touch_allowed_users_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
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
