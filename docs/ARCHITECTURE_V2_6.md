# Architecture v2.6

## Provider split

- `APP_ENV=local`: localStorage, no auth.
- `APP_ENV=prod`: Supabase Auth/Google + Postgres/RLS + Realtime + Storage.

UI/domain code is shared. `CollaborativeRepository` is the production boundary; local mode persists the same sanitized state shape.

## Feature modules

- `src/features/places/place-view.js`: place cards.
- `src/features/places/place-media.js`: image preview + local compression/data URL.
- `src/features/expenses/expense-view.js`: expense list + total/per-person average.
- `src/features/checklists/checklist-view.js`: checklist renderer.
- `src/features/checklists/checklist-controller.js`: checklist CRUD/permission orchestration.
- `src/data/repository.js`: Supabase trip/places/expenses/votes/checklists/storage facade.
- `src/data/supabase-client.js`: Auth/REST/RPC/Realtime/Storage HTTP client.

## Production data additions

Migration `supabase/migrations/002_trip_features.sql` adds:

- `trips.people_count`;
- `places.note_url`, `places.image_url`;
- `checklists` table;
- RLS rules for public/private checklist;
- Realtime publication for checklist/trip settings;
- public Storage bucket `place-images` with editor-only upload/update/delete.

## Checklist privacy

- Public: visible/editable by authenticated Trip members.
- Private: visible/editable/deletable only by creator.
- RLS is the source of truth; UI checks are convenience only.

## Mobile behavior

Places, Expenses and Checklist intentionally use document scrolling at <=820px. Nested list scrolling is disabled to improve one-handed mobile use.
