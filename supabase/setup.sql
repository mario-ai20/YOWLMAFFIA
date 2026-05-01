-- YOWLMAFFIA Supabase setup
-- Run this in the Supabase SQL editor.
-- If your existing project already has the base tables, you can also run
-- supabase/repair-existing-db.sql to add missing profile columns safely.

create extension if not exists pgcrypto;

create table if not exists public.allowed_users (
  username text primary key,
  email text not null unique,
  display_name text not null,
  accent text not null default '#72d4ff',
  avatar_url text not null default '',
  updated_at timestamptz not null default now(),
  bio text not null default '',
  status_message text not null default ''
);

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

insert into public.allowed_users (username, email, display_name, accent, avatar_url)
values
  ('Mattiz', 'mattizhoornaert@hotmail.com', 'Mattiz', '#ff6b9c', ''),
  ('Lukas', 'lukas.stevens@student.tsaam.be', 'Lukas', '#72d4ff', ''),
  ('Yoshi', 'bastiaenssens.yoshi@gmail.com', 'Yoshi', '#a6ff7c', '')
on conflict (username) do update
set
  email = excluded.email,
  display_name = excluded.display_name,
  accent = excluded.accent,
  avatar_url = coalesce(public.allowed_users.avatar_url, excluded.avatar_url),
  updated_at = now();

grant select on table public.allowed_users to anon, authenticated;
grant update on table public.allowed_users to authenticated;

alter table public.allowed_users enable row level security;

create or replace function public.is_allowed_yowl_user()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.allowed_users
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

create or replace function public.current_allowed_username()
  returns text
  language sql
  stable
  as $$
    select coalesce(
      (
        select u.username
        from public.allowed_users u
        where lower(u.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
        limit 1
      ),
      ''
    );
$$;

drop policy if exists "Anyone can read allowed users" on public.allowed_users;
create policy "Anyone can read allowed users"
  on public.allowed_users
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Authenticated users can update own allowed user" on public.allowed_users;
create policy "Authenticated users can update own allowed user"
  on public.allowed_users
  for update
  to authenticated
  using (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')) and public.is_allowed_yowl_user())
  with check (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')) and public.is_allowed_yowl_user());

create table if not exists public.songs (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'Untitled',
  lyrics text not null default '',
  cover_url text not null default '',
  status text not null default 'concept',
  last_edited_by text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.songs
  add column if not exists status text not null default 'concept';

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  scope text not null default 'team',
  room_key text not null default 'team',
  sender text not null,
  recipient text,
  body text not null default '',
  attachment_url text,
  attachment_type text,
  reply_to_message_id uuid,
  reply_to_sender text,
  reply_to_body text,
  reply_to_created_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.messages
  add column if not exists reply_to_message_id uuid;
alter table public.messages
  add column if not exists reply_to_sender text;
alter table public.messages
  add column if not exists reply_to_body text;
alter table public.messages
  add column if not exists reply_to_created_at timestamptz;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_username text not null,
  recipient_email text not null,
  actor_username text,
  kind text not null default 'system',
  title text not null,
  body text not null default '',
  link text,
  metadata jsonb not null default '{}'::jsonb,
  is_read boolean not null default false,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

grant select, update on table public.notifications to authenticated;

create table if not exists public.app_update_releases (
  id uuid primary key default gen_random_uuid(),
  version text not null unique,
  download_url text not null,
  notes text not null default '',
  is_required boolean not null default false,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

grant select on table public.app_update_releases to anon;
grant select on table public.app_update_releases to authenticated;
grant insert, update, delete on table public.app_update_releases to authenticated;

create table if not exists public.app_info_blocks (
  id text primary key default 'current',
  title text not null default '',
  body text not null default '',
  is_active boolean not null default true,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select on table public.app_info_blocks to anon;
grant select on table public.app_info_blocks to authenticated;
grant insert, update, delete on table public.app_info_blocks to authenticated;

create table if not exists public.music_releases (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  artist_name text not null default 'YOWLMAFFIA',
  spotify_url text not null,
  cover_url text not null default '',
  cover_storage_path text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select on table public.music_releases to anon;
grant select on table public.music_releases to authenticated;
grant insert, update, delete on table public.music_releases to authenticated;

alter table public.songs enable row level security;
alter table public.messages enable row level security;
alter table public.notifications enable row level security;
alter table public.app_update_releases enable row level security;
alter table public.app_info_blocks enable row level security;
alter table public.music_releases enable row level security;

drop policy if exists "Authenticated users can read songs" on public.songs;
create policy "Authenticated users can read songs"
  on public.songs
  for select
  to authenticated
  using (public.is_allowed_yowl_user());

drop policy if exists "Authenticated users can insert songs" on public.songs;
create policy "Authenticated users can insert songs"
  on public.songs
  for insert
  to authenticated
  with check (public.is_allowed_yowl_user());

drop policy if exists "Authenticated users can update songs" on public.songs;
create policy "Authenticated users can update songs"
  on public.songs
  for update
  to authenticated
  using (public.is_allowed_yowl_user())
  with check (public.is_allowed_yowl_user());

drop policy if exists "Authenticated users can delete songs" on public.songs;
create policy "Authenticated users can delete songs"
  on public.songs
  for delete
  to authenticated
  using (public.is_allowed_yowl_user());

drop policy if exists "Authenticated users can read messages" on public.messages;
create policy "Authenticated users can read messages"
  on public.messages
  for select
  to authenticated
  using (
    public.is_allowed_yowl_user()
    and (
      scope = 'team'
      or lower(sender) = lower(public.current_allowed_username())
      or lower(coalesce(recipient, '')) = lower(public.current_allowed_username())
    )
  );

drop policy if exists "Authenticated users can insert messages" on public.messages;
create policy "Authenticated users can insert messages"
  on public.messages
  for insert
  to authenticated
  with check (public.is_allowed_yowl_user());

drop policy if exists "Authenticated users can update messages" on public.messages;
create policy "Authenticated users can update messages"
  on public.messages
  for update
  to authenticated
  using (
    public.is_allowed_yowl_user()
    and lower(sender) = lower(public.current_allowed_username())
  )
  with check (
    public.is_allowed_yowl_user()
    and lower(sender) = lower(public.current_allowed_username())
  );

drop policy if exists "Authenticated users can delete messages" on public.messages;
create policy "Authenticated users can delete messages"
  on public.messages
  for delete
  to authenticated
  using (
    public.is_allowed_yowl_user()
    and lower(sender) = lower(public.current_allowed_username())
  );

drop policy if exists "Authenticated users can read notifications" on public.notifications;
create policy "Authenticated users can read notifications"
  on public.notifications
  for select
  to authenticated
  using (recipient_email = coalesce(auth.jwt() ->> 'email', '') and public.is_allowed_yowl_user());

drop policy if exists "Authenticated users can update notifications" on public.notifications;
create policy "Authenticated users can update notifications"
  on public.notifications
  for update
  to authenticated
  using (recipient_email = coalesce(auth.jwt() ->> 'email', '') and public.is_allowed_yowl_user())
  with check (recipient_email = coalesce(auth.jwt() ->> 'email', '') and public.is_allowed_yowl_user());

drop policy if exists "Mattiz can insert notifications" on public.notifications;
create policy "Mattiz can insert notifications"
  on public.notifications
  for insert
  to authenticated
  with check (
    public.is_allowed_yowl_user()
    and lower(public.current_allowed_username()) = 'mattiz'
  );

drop policy if exists "Anyone can read app update releases" on public.app_update_releases;
create policy "Anyone can read app update releases"
  on public.app_update_releases
  for select
  to public
  using (true);

drop policy if exists "Mattiz can publish app update releases" on public.app_update_releases;
create policy "Mattiz can publish app update releases"
  on public.app_update_releases
  for insert
  to authenticated
  with check (public.is_allowed_yowl_user() and lower(public.current_allowed_username()) = 'mattiz');

drop policy if exists "Mattiz can update app update releases" on public.app_update_releases;
create policy "Mattiz can update app update releases"
  on public.app_update_releases
  for update
  to authenticated
  using (public.is_allowed_yowl_user() and lower(public.current_allowed_username()) = 'mattiz')
  with check (public.is_allowed_yowl_user() and lower(public.current_allowed_username()) = 'mattiz');

drop policy if exists "Mattiz can delete app update releases" on public.app_update_releases;
create policy "Mattiz can delete app update releases"
  on public.app_update_releases
  for delete
  to authenticated
  using (public.is_allowed_yowl_user() and lower(public.current_allowed_username()) = 'mattiz');

drop policy if exists "Anyone can read app info blocks" on public.app_info_blocks;
create policy "Anyone can read app info blocks"
  on public.app_info_blocks
  for select
  to public
  using (true);

drop policy if exists "Mattiz can publish app info blocks" on public.app_info_blocks;
create policy "Mattiz can publish app info blocks"
  on public.app_info_blocks
  for insert
  to authenticated
  with check (public.is_allowed_yowl_user() and lower(public.current_allowed_username()) = 'mattiz');

drop policy if exists "Mattiz can update app info blocks" on public.app_info_blocks;
create policy "Mattiz can update app info blocks"
  on public.app_info_blocks
  for update
  to authenticated
  using (public.is_allowed_yowl_user() and lower(public.current_allowed_username()) = 'mattiz')
  with check (public.is_allowed_yowl_user() and lower(public.current_allowed_username()) = 'mattiz');

drop policy if exists "Mattiz can delete app info blocks" on public.app_info_blocks;
create policy "Mattiz can delete app info blocks"
  on public.app_info_blocks
  for delete
  to authenticated
  using (public.is_allowed_yowl_user() and lower(public.current_allowed_username()) = 'mattiz');

drop policy if exists "Anyone can read music releases" on public.music_releases;
create policy "Anyone can read music releases"
  on public.music_releases
  for select
  to public
  using (true);

drop policy if exists "Mattiz can publish music releases" on public.music_releases;
create policy "Mattiz can publish music releases"
  on public.music_releases
  for insert
  to authenticated
  with check (public.is_allowed_yowl_user() and lower(public.current_allowed_username()) = 'mattiz');

drop policy if exists "Mattiz can update music releases" on public.music_releases;
create policy "Mattiz can update music releases"
  on public.music_releases
  for update
  to authenticated
  using (public.is_allowed_yowl_user() and lower(public.current_allowed_username()) = 'mattiz')
  with check (public.is_allowed_yowl_user() and lower(public.current_allowed_username()) = 'mattiz');

drop policy if exists "Mattiz can delete music releases" on public.music_releases;
create policy "Mattiz can delete music releases"
  on public.music_releases
  for delete
  to authenticated
  using (public.is_allowed_yowl_user() and lower(public.current_allowed_username()) = 'mattiz');

do $$ 
begin
  alter publication supabase_realtime add table public.allowed_users;
exception
  when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.songs;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.messages;
exception
  when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.app_update_releases;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.app_info_blocks;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.music_releases;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.notifications;
exception
  when duplicate_object then null;
end $$;

create or replace function public.notify_song_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_email text := coalesce(auth.jwt() ->> 'email', '');
  actor_username text := '';
  actor_display_name text := '';
  notification_kind text;
  notification_title text;
  notification_body text;
begin
  select u.username, u.display_name
    into actor_username, actor_display_name
  from public.allowed_users u
  where lower(u.email) = lower(actor_email)
     or lower(u.username) = lower(coalesce(new.last_edited_by, ''))
     or lower(u.display_name) = lower(coalesce(new.last_edited_by, ''))
  limit 1;

  if actor_username = '' then
    actor_username := coalesce(new.last_edited_by, 'YOWLMAFFIA');
  end if;

  if actor_display_name = '' then
    actor_display_name := coalesce(new.last_edited_by, actor_username);
  end if;

  if tg_op = 'UPDATE'
     and old.title is not distinct from new.title
     and old.lyrics is not distinct from new.lyrics
     and old.cover_url is not distinct from new.cover_url
     and old.last_edited_by is not distinct from new.last_edited_by then
    return new;
  end if;

  notification_kind := case when tg_op = 'INSERT' then 'song_created' else 'song_updated' end;
  notification_title := case when tg_op = 'INSERT' then 'Nieuwe song' else 'Song aangepast' end;
  notification_body := case when tg_op = 'INSERT'
    then format('%s heeft "%s" aangemaakt.', actor_display_name, new.title)
    else format('%s heeft "%s" bewerkt.', actor_display_name, new.title)
  end;

  insert into public.notifications (
    recipient_username,
    recipient_email,
    actor_username,
    kind,
    title,
    body,
    link,
    metadata
  )
  select
    u.username,
    u.email,
    actor_username,
    notification_kind,
    notification_title,
    notification_body,
    format('/editor/%s', new.id),
    jsonb_build_object('song_id', new.id, 'song_title', new.title, 'source', 'songs')
  from public.allowed_users u
  where lower(u.email) <> lower(actor_email);

  return new;
end;
$$;

drop trigger if exists songs_notify_activity on public.songs;
create trigger songs_notify_activity
after insert or update on public.songs
for each row
execute function public.notify_song_activity();

create or replace function public.notify_message_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  actor_username text := '';
  actor_display_name text := '';
begin
  select u.username, u.display_name
    into actor_username, actor_display_name
  from public.allowed_users u
  where lower(u.email) = lower(actor_email)
     or lower(u.display_name) = lower(coalesce(new.sender, ''))
     or lower(u.username) = lower(coalesce(new.sender, ''))
  limit 1;

  if actor_username = '' then
    actor_username := coalesce(new.sender, 'YOWLMAFFIA');
  end if;

  if actor_display_name = '' then
    actor_display_name := coalesce(new.sender, actor_username);
  end if;

  if lower(coalesce(new.scope, 'team')) = 'private' and nullif(trim(coalesce(new.recipient, '')), '') is not null then
    insert into public.notifications (
      recipient_username,
      recipient_email,
      actor_username,
      kind,
      title,
      body,
      link,
      metadata
    )
    select
      u.username,
      u.email,
      actor_username,
      'private_message',
      format('Privébericht van %s', actor_display_name),
      coalesce(new.body, 'Nieuw privébericht'),
      '/chat',
      jsonb_build_object('message_id', new.id, 'scope', new.scope, 'room_key', new.room_key, 'sender', new.sender)
    from public.allowed_users u
    where lower(u.username) = lower(new.recipient)
      and lower(u.email) <> lower(actor_email);
  else
    insert into public.notifications (
      recipient_username,
      recipient_email,
      actor_username,
      kind,
      title,
      body,
      link,
      metadata
    )
    select
      u.username,
      u.email,
      actor_username,
      'team_message',
      format('Teambericht van %s', actor_display_name),
      coalesce(new.body, 'Nieuw teambericht'),
      '/chat',
      jsonb_build_object('message_id', new.id, 'scope', new.scope, 'room_key', new.room_key, 'sender', new.sender)
    from public.allowed_users u
    where lower(u.email) <> lower(actor_email);
  end if;

  return new;
end;
$$;

drop trigger if exists messages_notify_activity on public.messages;
create trigger messages_notify_activity
after insert on public.messages
for each row
execute function public.notify_message_activity();

insert into storage.buckets (id, name, public)
values ('covers', 'covers', true)
on conflict (id) do update
set public = excluded.public;

insert into storage.buckets (id, name, public)
values ('audio', 'audio', true)
on conflict (id) do update
set public = excluded.public;

insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do update
set public = excluded.public;

insert into storage.buckets (id, name, public)
values ('app-updates', 'app-updates', true)
on conflict (id) do update
set public = excluded.public;

drop policy if exists "Public read covers" on storage.objects;
create policy "Public read covers"
  on storage.objects
  for select
  using (bucket_id = 'covers');

drop policy if exists "Authenticated upload covers" on storage.objects;
create policy "Authenticated upload covers"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'covers' and public.is_allowed_yowl_user());

drop policy if exists "Authenticated update covers" on storage.objects;
create policy "Authenticated update covers"
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'covers' and public.is_allowed_yowl_user())
  with check (bucket_id = 'covers' and public.is_allowed_yowl_user());

drop policy if exists "Authenticated delete covers" on storage.objects;
create policy "Authenticated delete covers"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'covers' and public.is_allowed_yowl_user());

drop policy if exists "Public read audio" on storage.objects;
create policy "Public read audio"
  on storage.objects
  for select
  using (bucket_id = 'audio');

drop policy if exists "Authenticated upload audio" on storage.objects;
create policy "Authenticated upload audio"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'audio' and public.is_allowed_yowl_user());

drop policy if exists "Authenticated update audio" on storage.objects;
create policy "Authenticated update audio"
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'audio' and public.is_allowed_yowl_user())
  with check (bucket_id = 'audio' and public.is_allowed_yowl_user());

drop policy if exists "Authenticated delete audio" on storage.objects;
create policy "Authenticated delete audio"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'audio' and public.is_allowed_yowl_user());

drop policy if exists "Public read media" on storage.objects;
create policy "Public read media"
  on storage.objects
  for select
  using (bucket_id = 'media');

drop policy if exists "Authenticated upload media" on storage.objects;
create policy "Authenticated upload media"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'media' and public.is_allowed_yowl_user());

drop policy if exists "Authenticated update media" on storage.objects;
create policy "Authenticated update media"
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'media' and public.is_allowed_yowl_user())
  with check (bucket_id = 'media' and public.is_allowed_yowl_user());

drop policy if exists "Authenticated delete media" on storage.objects;
create policy "Authenticated delete media"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'media' and public.is_allowed_yowl_user());

drop policy if exists "Public read app updates" on storage.objects;
create policy "Public read app updates"
  on storage.objects
  for select
  using (bucket_id = 'app-updates');

drop policy if exists "Mattiz upload app updates" on storage.objects;
create policy "Mattiz upload app updates"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'app-updates' and public.is_allowed_yowl_user() and lower(public.current_allowed_username()) = 'mattiz');

drop policy if exists "Mattiz update app updates" on storage.objects;
create policy "Mattiz update app updates"
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'app-updates' and public.is_allowed_yowl_user() and lower(public.current_allowed_username()) = 'mattiz')
  with check (bucket_id = 'app-updates' and public.is_allowed_yowl_user() and lower(public.current_allowed_username()) = 'mattiz');

drop policy if exists "Mattiz delete app updates" on storage.objects;
create policy "Mattiz delete app updates"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'app-updates' and public.is_allowed_yowl_user() and lower(public.current_allowed_username()) = 'mattiz');
