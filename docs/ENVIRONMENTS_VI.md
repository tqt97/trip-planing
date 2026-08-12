# Môi trường local và production

## APP_ENV=local

```env
APP_ENV=local
HOME_NAME=Hotel Trường An Hotel
HOME_LAT=11.9370985
HOME_LNG=108.4220004
```

- Source of truth: `localStorage` của browser.
- Không Google Login.
- Không kết nối Supabase.
- Places và Expenses chỉ tồn tại trên thiết bị/browser hiện tại.
- Phù hợp development, demo và sử dụng offline cá nhân.

Chạy:

```bash
npm install
cp .env.example .env.local
npm run dev
```

## APP_ENV=prod

```env
APP_ENV=prod
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx
DEFAULT_TRIP_SLUG=dalat-2026
```

- Source of truth: Supabase Postgres.
- Google Login qua Supabase Auth.
- RLS quyết định quyền owner/editor/viewer.
- Realtime đồng bộ Places, Expenses, Votes và Members.
- `localStorage` chỉ còn dùng cho preference/trace/cache cục bộ, không phải source of truth của Trip.

Nếu `APP_ENV=prod` nhưng thiếu `SUPABASE_URL` hoặc `SUPABASE_PUBLISHABLE_KEY`, app dừng ở auth gate và báo lỗi cấu hình. App không âm thầm fallback sang localStorage để tránh hai nhóm nhìn thấy hai bộ data khác nhau.
