create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.trips (
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
  constraint trips_home_lat check (home_lat is null or home_lat between -90 and 90),
  constraint trips_home_lng check (home_lng is null or home_lng between -180 and 180)
);

create table if not exists public.trip_members (
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('owner','editor','viewer')),
  joined_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);

create table if not exists public.places (
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
  constraint places_trip_seed_unique unique(trip_id, seed_key),
  constraint places_id_trip_unique unique(id, trip_id),
  constraint places_lat check (lat is null or lat between -90 and 90),
  constraint places_lng check (lng is null or lng between -180 and 180),
  constraint places_distance check (distance_meters is null or distance_meters >= 0),
  constraint places_duration check (duration_seconds is null or duration_seconds >= 0)
);

create table if not exists public.expenses (
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

create table if not exists public.place_votes (
  trip_id uuid not null references public.trips(id) on delete cascade,
  place_id uuid not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (place_id, user_id),
  constraint place_votes_place_trip_fk foreign key (place_id, trip_id) references public.places(id, trip_id) on delete cascade
);

create index if not exists trip_members_user_idx on public.trip_members(user_id, trip_id);
create index if not exists places_trip_idx on public.places(trip_id, updated_at desc);
create index if not exists expenses_trip_idx on public.expenses(trip_id, created_at desc);
create index if not exists votes_trip_idx on public.place_votes(trip_id, place_id);

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists trips_touch_updated_at on public.trips;
create trigger trips_touch_updated_at before update on public.trips for each row execute function public.touch_updated_at();
drop trigger if exists places_touch_updated_at on public.places;
create trigger places_touch_updated_at before update on public.places for each row execute function public.touch_updated_at();
drop trigger if exists expenses_touch_updated_at on public.expenses;
create trigger expenses_touch_updated_at before update on public.expenses for each row execute function public.touch_updated_at();
drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at before update on public.profiles for each row execute function public.touch_updated_at();

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id,email,full_name,avatar_url)
  values(new.id,new.email,coalesce(new.raw_user_meta_data->>'full_name',new.raw_user_meta_data->>'name',''),coalesce(new.raw_user_meta_data->>'avatar_url',''))
  on conflict(id) do update set email=excluded.email, full_name=excluded.full_name, avatar_url=excluded.avatar_url, updated_at=now();
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert or update of email, raw_user_meta_data on auth.users for each row execute function public.handle_new_user();

create or replace function public.is_trip_member(p_trip uuid) returns boolean
language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.trip_members m where m.trip_id=p_trip and m.user_id=auth.uid())
$$;
create or replace function public.trip_role(p_trip uuid) returns text
language sql stable security definer set search_path=public as $$
  select role from public.trip_members where trip_id=p_trip and user_id=auth.uid()
$$;
create or replace function public.can_edit_trip(p_trip uuid) returns boolean
language sql stable security definer set search_path=public as $$
  select coalesce(public.trip_role(p_trip) in ('owner','editor'),false)
$$;
create or replace function public.shares_trip_with(p_user uuid) returns boolean
language sql stable security definer set search_path=public as $$
  select exists(
    select 1 from public.trip_members mine
    join public.trip_members theirs on theirs.trip_id=mine.trip_id
    where mine.user_id=auth.uid() and theirs.user_id=p_user
  )
$$;

create or replace function public.join_trip_by_slug(p_slug text)
returns table(trip_id uuid, role text)
language plpgsql security definer set search_path=public as $$
declare v_trip public.trips%rowtype; v_role text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  insert into public.profiles(id,email,full_name,avatar_url)
  select u.id,u.email,coalesce(u.raw_user_meta_data->>'full_name',u.raw_user_meta_data->>'name',''),coalesce(u.raw_user_meta_data->>'avatar_url','') from auth.users u where u.id=auth.uid()
  on conflict(id) do update set email=excluded.email, full_name=excluded.full_name, avatar_url=excluded.avatar_url, updated_at=now();
  select * into v_trip from public.trips where slug=p_slug and public_join=true for update;
  if not found then raise exception 'Trip not found or joining disabled'; end if;
  select m.role into v_role from public.trip_members m where m.trip_id=v_trip.id and m.user_id=auth.uid();
  if v_role is null then
    if exists(select 1 from public.trip_members where trip_id=v_trip.id) then v_role := 'editor'; else v_role := 'owner'; end if;
    insert into public.trip_members(trip_id,user_id,role) values(v_trip.id,auth.uid(),v_role);
    update public.trips set created_by=coalesce(created_by,auth.uid()) where id=v_trip.id;
  end if;
  return query select v_trip.id, v_role;
end $$;

alter table public.profiles enable row level security;
alter table public.trips enable row level security;
alter table public.trip_members enable row level security;
alter table public.places enable row level security;
alter table public.expenses enable row level security;
alter table public.place_votes enable row level security;

create policy profiles_shared_select on public.profiles for select to authenticated using (id=auth.uid() or public.shares_trip_with(id));
create policy profiles_self_update on public.profiles for update to authenticated using (id=auth.uid()) with check (id=auth.uid());

create policy trips_member_select on public.trips for select to authenticated using (public.is_trip_member(id));
create policy trips_owner_update on public.trips for update to authenticated using (public.trip_role(id)='owner') with check (public.trip_role(id)='owner');

create policy members_member_select on public.trip_members for select to authenticated using (public.is_trip_member(trip_id));
create policy members_owner_update on public.trip_members for update to authenticated using (public.trip_role(trip_id)='owner' and user_id <> auth.uid()) with check (public.trip_role(trip_id)='owner' and user_id <> auth.uid());
create policy members_owner_delete on public.trip_members for delete to authenticated using (public.trip_role(trip_id)='owner' and user_id <> auth.uid());

create policy places_member_select on public.places for select to authenticated using (public.is_trip_member(trip_id));
create policy places_editor_insert on public.places for insert to authenticated with check (public.can_edit_trip(trip_id) and (created_by is null or created_by=auth.uid()));
create policy places_editor_update on public.places for update to authenticated using (public.can_edit_trip(trip_id)) with check (public.can_edit_trip(trip_id));
create policy places_editor_delete on public.places for delete to authenticated using (public.can_edit_trip(trip_id));

create policy expenses_member_select on public.expenses for select to authenticated using (public.is_trip_member(trip_id));
create policy expenses_editor_insert on public.expenses for insert to authenticated with check (public.can_edit_trip(trip_id) and (created_by is null or created_by=auth.uid()));
create policy expenses_editor_update on public.expenses for update to authenticated using (public.can_edit_trip(trip_id)) with check (public.can_edit_trip(trip_id));
create policy expenses_editor_delete on public.expenses for delete to authenticated using (public.can_edit_trip(trip_id));

create policy votes_member_select on public.place_votes for select to authenticated using (public.is_trip_member(trip_id));
create policy votes_self_insert on public.place_votes for insert to authenticated with check (user_id=auth.uid() and public.is_trip_member(trip_id));
create policy votes_self_delete on public.place_votes for delete to authenticated using (user_id=auth.uid() and public.is_trip_member(trip_id));

revoke execute on function public.is_trip_member(uuid) from public, anon;
revoke execute on function public.trip_role(uuid) from public, anon;
revoke execute on function public.can_edit_trip(uuid) from public, anon;
revoke execute on function public.shares_trip_with(uuid) from public, anon;
revoke execute on function public.join_trip_by_slug(text) from public, anon;
grant execute on function public.is_trip_member(uuid) to authenticated;
grant execute on function public.trip_role(uuid) to authenticated;
grant execute on function public.can_edit_trip(uuid) to authenticated;
grant execute on function public.shares_trip_with(uuid) to authenticated;

grant usage on schema public to authenticated;
grant select,update on public.profiles to authenticated;
grant select,update on public.trips to authenticated;
grant select,delete on public.trip_members to authenticated;
grant update(role) on public.trip_members to authenticated;
grant select,insert,update,delete on public.places to authenticated;
grant select,insert,update,delete on public.expenses to authenticated;
grant select,insert,delete on public.place_votes to authenticated;
grant execute on function public.join_trip_by_slug(text) to authenticated;

-- Add collaborative tables to Supabase Realtime publication once.
do $$ begin
  alter publication supabase_realtime add table public.places;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.expenses;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.place_votes;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.trip_members;
exception when duplicate_object then null; end $$;
