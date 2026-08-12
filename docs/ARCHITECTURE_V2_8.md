# Architecture v2.8.1

## Runtime providers

- `APP_ENV=local` -> localStorage, no login, no Supabase requests.
- `APP_ENV=prod` -> Supabase Auth/Google + Postgres/RLS + Realtime + Storage.

The UI/domain layer is shared. Production state is authoritative in Supabase and is no longer mirrored into the localStorage state cache.

## Main boundaries

- `src/app/main.js`: application orchestration only.
- `src/data/repository.js`: collaborative Trip repository.
- `src/data/supabase-client.js`: Auth/REST/RPC/Realtime/Storage transport.
- `src/features/places/*`: place cards, media, routing.
- `src/features/expenses/*`: expenses and pagination.
- `src/features/checklists/*`: checklist CRUD + per-user completion UI.
- `src/features/album/*`: trip images/links, media, lightbox, pagination.
- `src/features/common/pagination-view.js`: shared pager.
- `src/features/diagnostics/*`: trace/error diagnostics.

## Production data

Core collaborative tables:

- `trips`
- `trip_members`
- `profiles`
- `places`
- `expenses`
- `place_votes`
- `checklists`
- `checklist_completions`
- `trip_album_items`

Storage buckets:

- `place-images`
- `trip-album`

Per-user checklist completion is represented by `(checklist_id, user_id)` rather than a shared boolean.

## Media lifecycle

Images uploaded by the app are deleted from Supabase Storage when the corresponding image is replaced or its place/album item is deleted. External URLs are never deleted by the client.

## Persistence isolation

Local state uses `dalat-nearby-planner:v6`. In production collaboration mode, the app clears legacy state-cache keys and does not persist shared Trip snapshots locally. UI preferences, auth session and diagnostics keep their own keys.

## Realtime

Realtime listens to places, expenses, votes, members, checklists, checklist completions, trip album and trip settings. Events are debounced before a full scoped reload to avoid rendering bursts.

## Mobile behavior

At <=820px, Places/Expenses/Checklist use natural document scrolling. Album uses a responsive thumbnail grid. Dialogs use mobile bottom-sheet sizing and protected viewport widths.
