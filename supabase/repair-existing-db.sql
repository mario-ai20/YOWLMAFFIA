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

alter table public.messages
  add column if not exists reply_to_message_id uuid;
alter table public.messages
  add column if not exists reply_to_sender text;
alter table public.messages
  add column if not exists reply_to_body text;
alter table public.messages
  add column if not exists reply_to_created_at timestamptz;


NOTIFY pgrst, 'reload schema';
