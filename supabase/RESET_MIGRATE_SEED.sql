-- DALAT NEARBY PLANNER v2.3 - RESET SHARED APP SCHEMA
-- WARNING: This deletes all app data in public.* tables below.
-- It does NOT delete Supabase Auth users in auth.users.

begin;

-- Remove auth trigger first so it cannot point at a dropped function.
drop trigger if exists on_auth_user_created on auth.users;

-- Drop app tables. CASCADE removes policies, FK dependencies and publication memberships.
delete from storage.objects where bucket_id in ('place-images','trip-album');
delete from storage.buckets where id in ('place-images','trip-album');

drop table if exists public.trip_album_items cascade;
drop table if exists public.checklist_completions cascade;
drop table if exists public.checklists cascade;
drop table if exists public.trip_timeline_items cascade;
drop table if exists public.place_votes cascade;
drop table if exists public.expenses cascade;
drop table if exists public.places cascade;
drop table if exists public.trip_members cascade;
drop table if exists public.trips cascade;
drop table if exists public.profiles cascade;

-- Drop helper/RPC functions explicitly for a clean rebuild.
drop function if exists public.join_trip_by_slug(text) cascade;
drop function if exists public.is_trip_member(uuid) cascade;
drop function if exists public.trip_role(uuid) cascade;
drop function if exists public.can_edit_trip(uuid) cascade;
drop function if exists public.shares_trip_with(uuid) cascade;
drop function if exists public.handle_new_user() cascade;
drop function if exists public.touch_updated_at() cascade;

commit;


-- DALAT NEARBY PLANNER v2.3 - CLEAN COLLABORATION SCHEMA
-- Run after supabase/RESET_ALL.sql when rebuilding from scratch.

begin;

create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.trips (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  home_name text not null default 'Home',
  home_lat double precision,
  home_lng double precision,
  public_join boolean not null default true,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trips_home_lat_chk check (home_lat is null or home_lat between -90 and 90),
  constraint trips_home_lng_chk check (home_lng is null or home_lng between -180 and 180)
);

create table public.trip_members (
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('owner','editor','viewer')),
  joined_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);

create table public.places (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  name text not null,
  address text not null default '',
  category text not null default 'other' check (category in ('food','cafe','attraction','shopping','other')),
  priority text not null default 'want' check (priority in ('must','want','maybe')),
  note text not null default '',
  lat double precision,
  lng double precision,
  distance_meters integer,
  duration_seconds integer,
  route_source text not null default 'fallback' check (route_source in ('ors','fallback')),
  source text not null default 'manual' check (source in ('manual','google-maps-url','imported','seed')),
  seed_key text,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint places_trip_seed_uq unique (trip_id, seed_key),
  constraint places_id_trip_uq unique (id, trip_id),
  constraint places_lat_chk check (lat is null or lat between -90 and 90),
  constraint places_lng_chk check (lng is null or lng between -180 and 180),
  constraint places_distance_chk check (distance_meters is null or distance_meters >= 0),
  constraint places_duration_chk check (duration_seconds is null or duration_seconds >= 0)
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  payer text not null,
  category text not null default 'other' check (category in ('food','cafe','transport','attraction','shopping','stay','other')),
  amount_vnd bigint not null check (amount_vnd > 0),
  note text not null default '',
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.place_votes (
  trip_id uuid not null references public.trips(id) on delete cascade,
  place_id uuid not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (place_id, user_id),
  constraint place_votes_place_trip_fk
    foreign key (place_id, trip_id)
    references public.places(id, trip_id)
    on delete cascade
);

create index trip_members_user_idx on public.trip_members(user_id, trip_id);
create index places_trip_idx on public.places(trip_id, updated_at desc);
create index expenses_trip_idx on public.expenses(trip_id, created_at desc);
create index votes_trip_idx on public.place_votes(trip_id, place_id);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at
before update on public.profiles
for each row execute function public.touch_updated_at();

create trigger trips_touch_updated_at
before update on public.trips
for each row execute function public.touch_updated_at();

create trigger places_touch_updated_at
before update on public.places
for each row execute function public.touch_updated_at();

create trigger expenses_touch_updated_at
before update on public.expenses
for each row execute function public.touch_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
    coalesce(new.raw_user_meta_data->>'avatar_url', '')
  )
  on conflict (id) do update
  set email = excluded.email,
      full_name = excluded.full_name,
      avatar_url = excluded.avatar_url,
      updated_at = now();
  return new;
end;
$$;

create trigger on_auth_user_created
after insert or update of email, raw_user_meta_data on auth.users
for each row execute function public.handle_new_user();

-- Backfill profiles for Auth users that already existed before this migration.
insert into public.profiles (id, email, full_name, avatar_url)
select
  au.id,
  au.email,
  coalesce(au.raw_user_meta_data->>'full_name', au.raw_user_meta_data->>'name', ''),
  coalesce(au.raw_user_meta_data->>'avatar_url', '')
from auth.users as au
on conflict (id) do update
set email = excluded.email,
    full_name = excluded.full_name,
    avatar_url = excluded.avatar_url,
    updated_at = now();

create or replace function public.is_trip_member(p_trip uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.trip_members as tm
    where tm.trip_id = p_trip
      and tm.user_id = auth.uid()
  );
$$;

create or replace function public.trip_role(p_trip uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select tm.role
  from public.trip_members as tm
  where tm.trip_id = p_trip
    and tm.user_id = auth.uid()
  limit 1;
$$;

create or replace function public.can_edit_trip(p_trip uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.trip_role(p_trip) in ('owner', 'editor'), false);
$$;

create or replace function public.shares_trip_with(p_other_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.trip_members as mine
    join public.trip_members as theirs
      on theirs.trip_id = mine.trip_id
    where mine.user_id = auth.uid()
      and theirs.user_id = p_other_user
  );
$$;

-- Fully qualified aliases are intentional here. The function returns columns named
-- trip_id/role, so any unqualified trip_id reference in PL/pgSQL can become ambiguous.
create or replace function public.join_trip_by_slug(p_slug text)
returns table (trip_id uuid, role text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trip public.trips%rowtype;
  v_role text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  insert into public.profiles (id, email, full_name, avatar_url)
  select
    au.id,
    au.email,
    coalesce(au.raw_user_meta_data->>'full_name', au.raw_user_meta_data->>'name', ''),
    coalesce(au.raw_user_meta_data->>'avatar_url', '')
  from auth.users as au
  where au.id = auth.uid()
  on conflict (id) do update
  set email = excluded.email,
      full_name = excluded.full_name,
      avatar_url = excluded.avatar_url,
      updated_at = now();

  select t.*
  into v_trip
  from public.trips as t
  where t.slug = p_slug
    and t.public_join = true
  for update;

  if not found then
    raise exception 'Trip not found or joining disabled';
  end if;

  select tm.role
  into v_role
  from public.trip_members as tm
  where tm.trip_id = v_trip.id
    and tm.user_id = auth.uid();

  if v_role is null then
    if exists (
      select 1
      from public.trip_members as existing_member
      where existing_member.trip_id = v_trip.id
    ) then
      v_role := 'editor';
    else
      v_role := 'owner';
    end if;

    insert into public.trip_members (trip_id, user_id, role)
    values (v_trip.id, auth.uid(), v_role);

    update public.trips as t
    set created_by = coalesce(t.created_by, auth.uid())
    where t.id = v_trip.id;
  end if;

  return query
  select v_trip.id, v_role;
end;
$$;

alter table public.profiles enable row level security;
alter table public.trips enable row level security;
alter table public.trip_members enable row level security;
alter table public.places enable row level security;
alter table public.expenses enable row level security;
alter table public.place_votes enable row level security;

create policy profiles_shared_select
on public.profiles for select to authenticated
using (
  public.profiles.id = auth.uid()
  or public.shares_trip_with(public.profiles.id)
);

create policy profiles_self_update
on public.profiles for update to authenticated
using (public.profiles.id = auth.uid())
with check (public.profiles.id = auth.uid());

create policy trips_member_select
on public.trips for select to authenticated
using (public.is_trip_member(public.trips.id));

create policy trips_owner_update
on public.trips for update to authenticated
using (public.trip_role(public.trips.id) = 'owner')
with check (public.trip_role(public.trips.id) = 'owner');

create policy members_member_select
on public.trip_members for select to authenticated
using (public.is_trip_member(public.trip_members.trip_id));

create policy members_owner_update
on public.trip_members for update to authenticated
using (
  public.trip_role(public.trip_members.trip_id) = 'owner'
  and public.trip_members.user_id <> auth.uid()
)
with check (
  public.trip_role(public.trip_members.trip_id) = 'owner'
  and public.trip_members.user_id <> auth.uid()
);

create policy members_owner_delete
on public.trip_members for delete to authenticated
using (
  public.trip_role(public.trip_members.trip_id) = 'owner'
  and public.trip_members.user_id <> auth.uid()
);

create policy places_member_select
on public.places for select to authenticated
using (public.is_trip_member(public.places.trip_id));

create policy places_editor_insert
on public.places for insert to authenticated
with check (
  public.can_edit_trip(public.places.trip_id)
  and (public.places.created_by is null or public.places.created_by = auth.uid())
);

create policy places_editor_update
on public.places for update to authenticated
using (public.can_edit_trip(public.places.trip_id))
with check (public.can_edit_trip(public.places.trip_id));

create policy places_editor_delete
on public.places for delete to authenticated
using (public.can_edit_trip(public.places.trip_id));

create policy expenses_member_select
on public.expenses for select to authenticated
using (public.is_trip_member(public.expenses.trip_id));

create policy expenses_editor_insert
on public.expenses for insert to authenticated
with check (
  public.can_edit_trip(public.expenses.trip_id)
  and (public.expenses.created_by is null or public.expenses.created_by = auth.uid())
);

create policy expenses_editor_update
on public.expenses for update to authenticated
using (public.can_edit_trip(public.expenses.trip_id))
with check (public.can_edit_trip(public.expenses.trip_id));

create policy expenses_editor_delete
on public.expenses for delete to authenticated
using (public.can_edit_trip(public.expenses.trip_id));

create policy votes_member_select
on public.place_votes for select to authenticated
using (public.is_trip_member(public.place_votes.trip_id));

create policy votes_self_insert
on public.place_votes for insert to authenticated
with check (
  public.place_votes.user_id = auth.uid()
  and public.is_trip_member(public.place_votes.trip_id)
);

create policy votes_self_delete
on public.place_votes for delete to authenticated
using (
  public.place_votes.user_id = auth.uid()
  and public.is_trip_member(public.place_votes.trip_id)
);

revoke all on public.profiles, public.trips, public.trip_members, public.places, public.expenses, public.place_votes from anon;
revoke all on public.profiles, public.trips, public.trip_members, public.places, public.expenses, public.place_votes from public;

grant usage on schema public to authenticated;
grant select, update on public.profiles to authenticated;
grant select, update on public.trips to authenticated;
grant select, delete on public.trip_members to authenticated;
grant update(role) on public.trip_members to authenticated;
grant select, insert, update, delete on public.places to authenticated;
grant select, insert, update, delete on public.expenses to authenticated;
grant select, insert, delete on public.place_votes to authenticated;

revoke execute on function public.is_trip_member(uuid) from public, anon;
revoke execute on function public.trip_role(uuid) from public, anon;
revoke execute on function public.can_edit_trip(uuid) from public, anon;
revoke execute on function public.shares_trip_with(uuid) from public, anon;
revoke execute on function public.join_trip_by_slug(text) from public, anon;

grant execute on function public.is_trip_member(uuid) to authenticated;
grant execute on function public.trip_role(uuid) to authenticated;
grant execute on function public.can_edit_trip(uuid) to authenticated;
grant execute on function public.shares_trip_with(uuid) to authenticated;
grant execute on function public.join_trip_by_slug(text) to authenticated;

-- Better UPDATE/DELETE payloads for realtime consumers.
alter table public.places replica identity full;
alter table public.expenses replica identity full;
alter table public.place_votes replica identity full;
alter table public.trip_members replica identity full;

-- Add shared mutable tables to Supabase Realtime once.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'places'
  ) then
    alter publication supabase_realtime add table public.places;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'expenses'
  ) then
    alter publication supabase_realtime add table public.expenses;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'place_votes'
  ) then
    alter publication supabase_realtime add table public.place_votes;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'trip_members'
  ) then
    alter publication supabase_realtime add table public.trip_members;
  end if;
end;
$$;

commit;


-- DALAT NEARBY PLANNER v2.6 - EXPENSE SPLIT + MEDIA + CHECKLISTS
begin;

alter table public.trips
  add column if not exists people_count integer not null default 2
  check (people_count between 1 and 50);

alter table public.places
  add column if not exists note_url text not null default '',
  add column if not exists image_url text not null default '';

create table if not exists public.checklists (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  title text not null,
  category text not null default 'prepare' check (category in ('prepare','during')),
  visibility text not null default 'public' check (visibility in ('public','private')),
  done boolean not null default false,
  note text not null default '',
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists checklists_trip_idx on public.checklists(trip_id, updated_at desc);

drop trigger if exists checklists_touch_updated_at on public.checklists;
create trigger checklists_touch_updated_at
before update on public.checklists
for each row execute function public.touch_updated_at();

alter table public.checklists enable row level security;

-- All Trip members can see public items. Private items are only visible to their creator.
drop policy if exists checklists_visible_select on public.checklists;
create policy checklists_visible_select
on public.checklists for select to authenticated
using (
  public.is_trip_member(public.checklists.trip_id)
  and (public.checklists.visibility = 'public' or public.checklists.created_by = auth.uid())
);

-- Every Trip member may create a checklist item. Private ownership is always the current user.
drop policy if exists checklists_member_insert on public.checklists;
create policy checklists_member_insert
on public.checklists for insert to authenticated
with check (
  public.is_trip_member(public.checklists.trip_id)
  and public.checklists.created_by = auth.uid()
);

-- Public checklist is collaborative, private checklist is creator-only.
drop policy if exists checklists_member_update on public.checklists;
create policy checklists_member_update
on public.checklists for update to authenticated
using (
  public.is_trip_member(public.checklists.trip_id)
  and (public.checklists.visibility = 'public' or public.checklists.created_by = auth.uid())
)
with check (
  public.is_trip_member(public.checklists.trip_id)
  and (public.checklists.visibility = 'public' or public.checklists.created_by = auth.uid())
);

drop policy if exists checklists_member_delete on public.checklists;
create policy checklists_member_delete
on public.checklists for delete to authenticated
using (
  public.is_trip_member(public.checklists.trip_id)
  and (public.checklists.visibility = 'public' or public.checklists.created_by = auth.uid())
);

-- Editors can change trip-level split settings. This supersedes the owner-only update policy.
drop policy if exists trips_owner_update on public.trips;
drop policy if exists trips_editor_update on public.trips;
create policy trips_editor_update
on public.trips for update to authenticated
using (public.can_edit_trip(public.trips.id))
with check (public.can_edit_trip(public.trips.id));

revoke all on public.checklists from anon, public;
grant select, insert, update, delete on public.checklists to authenticated;

alter table public.checklists replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'checklists'
  ) then
    alter publication supabase_realtime add table public.checklists;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'trips'
  ) then
    alter publication supabase_realtime add table public.trips;
  end if;
end;
$$;

-- Public media bucket for place photos. Object paths are trip_id/place_id/file.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('place-images', 'place-images', true, 5242880, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Upload/delete is limited to Trip editors. Public bucket makes download URLs directly usable by the UI.
drop policy if exists place_images_editor_insert on storage.objects;
create policy place_images_editor_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'place-images'
  and public.can_edit_trip(((storage.foldername(name))[1])::uuid)
);

drop policy if exists place_images_editor_update on storage.objects;
create policy place_images_editor_update on storage.objects
for update to authenticated
using (
  bucket_id = 'place-images'
  and public.can_edit_trip(((storage.foldername(name))[1])::uuid)
)
with check (
  bucket_id = 'place-images'
  and public.can_edit_trip(((storage.foldername(name))[1])::uuid)
);

drop policy if exists place_images_editor_delete on storage.objects;
create policy place_images_editor_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'place-images'
  and public.can_edit_trip(((storage.foldername(name))[1])::uuid)
);

commit;


-- DALAT NEARBY PLANNER v2.7 - TRIP ALBUM + CHECKLIST COMPLETION ACTOR
begin;

alter table public.trips alter column people_count set default 4;
update public.trips set people_count = 4 where people_count is null;

alter table public.checklists
  add column if not exists completed_by uuid null references auth.users(id) on delete set null,
  add column if not exists completed_at timestamptz null;

create or replace function public.capture_checklist_completion()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.done = true and (tg_op = 'INSERT' or old.done is distinct from true) then
    new.completed_by := auth.uid();
    new.completed_at := now();
  elsif new.done = false then
    new.completed_by := null;
    new.completed_at := null;
  elsif tg_op = 'UPDATE' and old.done = true and new.done = true then
    -- Completion identity is server-owned: ordinary edits cannot impersonate another member.
    new.completed_by := old.completed_by;
    new.completed_at := old.completed_at;
  end if;
  return new;
end;
$$;

drop trigger if exists checklists_capture_completion on public.checklists;
create trigger checklists_capture_completion
before insert or update of done on public.checklists
for each row execute function public.capture_checklist_completion();

create table if not exists public.trip_album_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  title text not null,
  status text not null default 'reference' check (status in ('reference','want','visited')),
  note text not null default '',
  note_url text not null default '',
  image_url text not null default '',
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists trip_album_items_trip_idx on public.trip_album_items(trip_id, updated_at desc);
drop trigger if exists trip_album_items_touch_updated_at on public.trip_album_items;
create trigger trip_album_items_touch_updated_at before update on public.trip_album_items for each row execute function public.touch_updated_at();
alter table public.trip_album_items enable row level security;

drop policy if exists album_trip_select on public.trip_album_items;
create policy album_trip_select on public.trip_album_items for select to authenticated using (public.is_trip_member(public.trip_album_items.trip_id));
drop policy if exists album_editor_insert on public.trip_album_items;
create policy album_editor_insert on public.trip_album_items for insert to authenticated with check (public.can_edit_trip(public.trip_album_items.trip_id) and public.trip_album_items.created_by = auth.uid());
drop policy if exists album_editor_update on public.trip_album_items;
create policy album_editor_update on public.trip_album_items for update to authenticated using (public.can_edit_trip(public.trip_album_items.trip_id)) with check (public.can_edit_trip(public.trip_album_items.trip_id));
drop policy if exists album_editor_delete on public.trip_album_items;
create policy album_editor_delete on public.trip_album_items for delete to authenticated using (public.can_edit_trip(public.trip_album_items.trip_id));
revoke all on public.trip_album_items from anon, public;
grant select, insert, update, delete on public.trip_album_items to authenticated;
alter table public.trip_album_items replica identity full;

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='trip_album_items') then
    alter publication supabase_realtime add table public.trip_album_items;
  end if;
end $$;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('trip-album','trip-album',true,5242880,array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists trip_album_editor_insert on storage.objects;
create policy trip_album_editor_insert on storage.objects for insert to authenticated with check (bucket_id='trip-album' and public.can_edit_trip(((storage.foldername(name))[1])::uuid));
drop policy if exists trip_album_editor_update on storage.objects;
create policy trip_album_editor_update on storage.objects for update to authenticated using (bucket_id='trip-album' and public.can_edit_trip(((storage.foldername(name))[1])::uuid)) with check (bucket_id='trip-album' and public.can_edit_trip(((storage.foldername(name))[1])::uuid));
drop policy if exists trip_album_editor_delete on storage.objects;
create policy trip_album_editor_delete on storage.objects for delete to authenticated using (bucket_id='trip-album' and public.can_edit_trip(((storage.foldername(name))[1])::uuid));

commit;


-- DALAT NEARBY PLANNER v2.8 - PER-USER CHECKLIST COMPLETIONS

create table if not exists public.checklist_completions (
  trip_id uuid not null references public.trips(id) on delete cascade,
  checklist_id uuid not null references public.checklists(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  completed_at timestamptz not null default now(),
  primary key (checklist_id, user_id)
);

create index if not exists checklist_completions_trip_idx
  on public.checklist_completions(trip_id, checklist_id, completed_at asc);

alter table public.checklist_completions enable row level security;

drop policy if exists checklist_completions_visible_select on public.checklist_completions;
create policy checklist_completions_visible_select
on public.checklist_completions for select to authenticated
using (
  public.is_trip_member(public.checklist_completions.trip_id)
  and exists (
    select 1
    from public.checklists as c
    where c.id = public.checklist_completions.checklist_id
      and c.trip_id = public.checklist_completions.trip_id
      and (c.visibility = 'public' or c.created_by = auth.uid())
  )
);

drop policy if exists checklist_completions_self_insert on public.checklist_completions;
create policy checklist_completions_self_insert
on public.checklist_completions for insert to authenticated
with check (
  public.checklist_completions.user_id = auth.uid()
  and public.is_trip_member(public.checklist_completions.trip_id)
  and exists (
    select 1
    from public.checklists as c
    where c.id = public.checklist_completions.checklist_id
      and c.trip_id = public.checklist_completions.trip_id
      and (c.visibility = 'public' or c.created_by = auth.uid())
  )
);

drop policy if exists checklist_completions_self_delete on public.checklist_completions;
create policy checklist_completions_self_delete
on public.checklist_completions for delete to authenticated
using (
  public.checklist_completions.user_id = auth.uid()
  and public.is_trip_member(public.checklist_completions.trip_id)
  and exists (
    select 1
    from public.checklists as c
    where c.id = public.checklist_completions.checklist_id
      and c.trip_id = public.checklist_completions.trip_id
      and (c.visibility = 'public' or c.created_by = auth.uid())
  )
);

revoke all on public.checklist_completions from anon, public;
grant select, insert, delete on public.checklist_completions to authenticated;

alter table public.checklist_completions replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'checklist_completions'
  ) then
    alter publication supabase_realtime add table public.checklist_completions;
  end if;
end $$;

-- Migrate legacy single-user completion history if present.
insert into public.checklist_completions (trip_id, checklist_id, user_id, completed_at)
select c.trip_id, c.id, c.completed_by, coalesce(c.completed_at, c.updated_at, now())
from public.checklists as c
where c.done = true
  and c.completed_by is not null
on conflict (checklist_id, user_id) do nothing;

-- Legacy shared completion trigger is no longer used.
drop trigger if exists checklists_capture_completion on public.checklists;



-- v2.9 Timeline + expense settlement
alter table public.expenses add column if not exists participants text[] not null default '{}'::text[];

create table if not exists public.trip_timeline_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  day_date date not null,
  start_time time not null default '08:00',
  title text not null check (char_length(title) between 2 and 180),
  place_id uuid references public.places(id) on delete set null,
  place_name text not null default '',
  note text not null default '',
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_trip_timeline_items_trip_day_time on public.trip_timeline_items(trip_id, day_date, start_time);
alter table public.trip_timeline_items enable row level security;

drop policy if exists "timeline members can read" on public.trip_timeline_items;
create policy "timeline members can read" on public.trip_timeline_items for select to authenticated
using (public.is_trip_member(public.trip_timeline_items.trip_id));
drop policy if exists "timeline editors can insert" on public.trip_timeline_items;
create policy "timeline editors can insert" on public.trip_timeline_items for insert to authenticated
with check (public.can_edit_trip(public.trip_timeline_items.trip_id) and public.trip_timeline_items.created_by = auth.uid());
drop policy if exists "timeline editors can update" on public.trip_timeline_items;
create policy "timeline editors can update" on public.trip_timeline_items for update to authenticated
using (public.can_edit_trip(public.trip_timeline_items.trip_id)) with check (public.can_edit_trip(public.trip_timeline_items.trip_id));
drop policy if exists "timeline editors can delete" on public.trip_timeline_items;
create policy "timeline editors can delete" on public.trip_timeline_items for delete to authenticated
using (public.can_edit_trip(public.trip_timeline_items.trip_id));

grant select, insert, update, delete on public.trip_timeline_items to authenticated;

do $$ begin alter publication supabase_realtime add table public.trip_timeline_items; exception when duplicate_object then null; end $$;


-- Default shared Trip. Edit these values if your Vercel DEFAULT_TRIP_SLUG/Home differs.
insert into public.trips (
  slug,
  name,
  home_name,
  home_lat,
  home_lng,
  public_join,
  people_count
)
values (
  'dalat-2026',
  'Đà Lạt 2026',
  'Hotel Trường An Hotel',
  11.9370985,
  108.4220004,
  true,
  4
)
on conflict (slug) do update
set name = excluded.name,
    home_name = excluded.home_name,
    home_lat = excluded.home_lat,
    home_lng = excluded.home_lng,
    public_join = excluded.public_join,
    people_count = excluded.people_count,
    updated_at = now();
