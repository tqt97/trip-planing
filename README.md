# Đà Lạt Nearby Planner v2.9.5

Mobile-first collaborative trip planner.

```text
APP_ENV=local -> localStorage, không login
APP_ENV=prod  -> Supabase Auth + Postgres/RLS + Realtime + Storage
```

## Chạy local

```bash
npm install
cp .env.example .env.local
npm run dev
```

Ví dụ:

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

Xem `docs/DEPLOY_VERCEL_SUPABASE_GOOGLE_VI.md`.

## Database migrations

Theo thứ tự:

1. `001_v2_collaboration.sql`
2. `002_trip_features.sql`
3. `003_album_checklist_completion.sql`
4. `004_checklist_per_user_completion.sql`

Dựng sạch có thể chạy `supabase/RESET_MIGRATE_SEED.sql`.

## Tính năng chính

- Places + Google Maps + ORS/fallback ETA + vote.
- Radar Home và gợi ý Top 6.
- Expenses, số người và trung bình/người.
- Checklist public/private với completion riêng từng user.
- Ảnh & link tham khảo + Supabase Storage + lightbox.
- Member roles owner/editor/viewer.
- Realtime sync.
- Export/import local data.
- Diagnostics/trace trên UI.

## Quality

```bash
npm run quality
```

Hiện tại: 47/47 tests + UI/performance/build/smoke + 2,000 monkey mutations PASS.

- Kiến trúc: `docs/ARCHITECTURE_V2_8.md`
- Audit: `docs/AUDIT_V2_8_1.md`
- Quality: `docs/QUALITY_REPORT.md`


## v2.9.5 — Timeline, chốt tiền, PWA

- Timeline theo ngày + giờ, tự sắp xếp từ sáng → trưa → chiều → tối.
- Chi tiêu hỗ trợ `participants` cho từng khoản và mục **Chốt tiền / Ai nợ ai**.
- PWA với `manifest.webmanifest` + `sw.js`, cài được lên Home Screen và cache app shell/static assets.
- Production Supabase cần chạy `supabase/migrations/005_timeline_expense_settlement.sql`.
