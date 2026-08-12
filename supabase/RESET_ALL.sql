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
