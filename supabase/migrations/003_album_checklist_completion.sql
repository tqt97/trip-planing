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
