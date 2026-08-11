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
