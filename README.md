# Đà Lạt Nearby Planner v2.0.0

Planner mobile-first cho nhóm đi Đà Lạt: Places, Radar Home, ETA, Google Maps links, Expenses, **vote địa điểm**, Google Login, member roles và realtime sync.

## Chạy nhanh local

```bash
cp .env.example .env.local
# Điền Supabase config
# Chạy migration SQL trong Supabase trước
npm run db:seed
npm run quality
npm run dev
```

Mở `http://127.0.0.1:3000`.

## Cấu trúc chính

```text
api/                       Vercel Functions cho ORS + public runtime config
data/default-places.json   Trip + Places seed mặc định
src/core.js                Pure domain logic / ranking / ETA / radar
src/data/                  Supabase Auth/REST/Realtime + repository
src/app/                   UI/storage/radar modules
supabase/migrations/       Schema, RLS, RPC, Realtime publication
scripts/db-seed.mjs        Idempotent seed dùng service-role secret
```

## Environment

Xem `.env.example`.

Client được phép nhận:

```text
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
DEFAULT_TRIP_SLUG
```

Server-only:

```text
SUPABASE_SECRET_KEY        # chỉ dùng local/admin seed
SUPABASE_SERVICE_ROLE_KEY  # legacy fallback
OPENROUTESERVICE_API_KEY   # chỉ Vercel Function/server
```

## Quality

```bash
npm run quality
```

Chạy lint/security, unit/API/repository tests, UI quality gate, build, smoke và monkey test.
