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
