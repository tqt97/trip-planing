# Đà Lạt Nearby Planner v2.5.1

Mobile-first trip planner với hai data mode rõ ràng:

```text
APP_ENV=local -> localStorage, không login
APP_ENV=prod  -> Supabase Auth + Postgres/RLS + Realtime
```

## Local

```bash
npm install
cp .env.example .env.local
npm run dev
```

`.env.local`:

```env
APP_ENV=local
HOME_NAME=Hotel Trường An Hotel
HOME_LAT=11.9370985
HOME_LNG=108.4220004
```

## Production / Vercel

```env
APP_ENV=prod
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx
DEFAULT_TRIP_SLUG=dalat-2026
```

Đọc [docs/DEPLOY_VERCEL_SUPABASE_GOOGLE_VI.md](docs/DEPLOY_VERCEL_SUPABASE_GOOGLE_VI.md).

## Database clean setup

- `supabase/RESET_ALL.sql`: xóa schema app cũ.
- `supabase/migrations/001_v2_collaboration.sql`: schema + RLS + RPC + Realtime.
- `supabase/002_seed_default_trip.sql`: tạo Trip `dalat-2026`.
- `supabase/RESET_MIGRATE_SEED.sql`: reset + migrate + seed một lần.

RPC join đã dùng table alias đầy đủ để tránh lỗi PostgreSQL `column reference "trip_id" is ambiguous`.

## Default places

Chỉnh `data/default-places.json`. Nếu muốn seed data thật vào Supabase bằng script admin local:

```env
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_SECRET_KEY=sb_secret_xxx
```

rồi:

```bash
npm run db:seed
```

Không đưa `SUPABASE_SECRET_KEY`/service-role key lên frontend hoặc Vercel runtime của app.


## v2.5.1 UI hotfix

- Modal **Nhóm** dùng cùng surface/khung với các form khác ở desktop và mobile.
- `Tọa độ` trong form thêm địa điểm mặc định mở trên mobile (<=820px).
- `content-visibility` chỉ còn bật trên desktop để tránh layout shift khi vừa mở app trên điện thoại.
- Mobile dialog dùng `100dvw` guard và members panel có width/padding/background ổn định.

## Quality

```bash
npm run quality
```

Chạy lint/security, unit/API/RLS tests, UI gate, performance budget, build, smoke và monkey tests.
