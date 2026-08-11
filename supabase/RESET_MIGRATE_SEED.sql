-- DALAT NEARBY PLANNER v2.3 - ONE SHOT CLEAN REBUILD
-- WARNING: deletes all app data in public tables. Auth users are preserved.

-- DALAT NEARBY PLANNER v2.3 - RESET SHARED APP SCHEMA
-- WARNING: This deletes all app data in public.* tables below.
-- It does NOT delete Supabase Auth users in auth.users.

begin;

-- Remove auth trigger first so it cannot point at a dropped function.
drop trigger if exists on_auth_user_created on auth.users;

-- Drop app tables. CASCADE removes policies, FK dependencies and publication memberships.
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

-- Default shared Trip. Edit these values if your Vercel DEFAULT_TRIP_SLUG/Home differs.
insert into public.trips (
  slug,
  name,
  home_name,
  home_lat,
  home_lng,
  public_join
)
values (
  'dalat-2026',
  'Đà Lạt 2026',
  'Hotel Trường An Hotel',
  11.9370985,
  108.4220004,
  true
)
on conflict (slug) do update
set name = excluded.name,
    home_name = excluded.home_name,
    home_lat = excluded.home_lat,
    home_lng = excluded.home_lng,
    public_join = excluded.public_join,
    updated_at = now();
