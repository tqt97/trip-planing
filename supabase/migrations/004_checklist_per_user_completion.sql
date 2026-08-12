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

