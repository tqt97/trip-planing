
## v2.7

- Places/Radar mặc định **Tất cả khoảng cách**.
- Chi tiêu mặc định **4 người** và tính trung bình/người.
- **Trip Album**: ảnh/link tham khảo, trạng thái Tham khảo/Muốn đi/Đã đi, horizontal gallery + lightbox.
- Checklist hiển thị người đã check done bằng avatar chữ cái đầu email.
- Production hiện tại chỉ cần chạy `supabase/migrations/003_album_checklist_completion.sql`.

# Đà Lạt Nearby Planner v2.7.3

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
- `supabase/migrations/001_v2_collaboration.sql`: schema collaboration nền.
- `supabase/migrations/002_trip_features.sql`: chia chi phí, ảnh/link địa điểm, checklist + RLS/Realtime/Storage.
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


## v2.6 Trip utilities

- Mobile Places/Expenses/Checklist dùng **page scroll tự nhiên**, không còn nested scroll.
- Chi tiêu có `Số người` và `Trung bình/người`; production lưu `trips.people_count`.
- Place hỗ trợ `noteUrl` và upload ảnh. Local nén/lưu data URL trong localStorage; production upload vào Supabase Storage bucket `place-images`.
- Checklist có loại `Chuẩn bị` / `Trong chuyến`, visibility `public` / `private`. Public cho thành viên Trip cùng sửa; private chỉ người tạo thấy/sửa.
- Export/import local state đã lên version 4, giữ Places + Expenses + Checklist + trip settings.

Nếu database production đã có v2.5, chỉ cần chạy `supabase/migrations/002_trip_features.sql`. Nếu muốn dựng sạch từ đầu, chạy `supabase/RESET_MIGRATE_SEED.sql`.


Kiến trúc chi tiết: [docs/ARCHITECTURE_V2_6.md](docs/ARCHITECTURE_V2_6.md).
