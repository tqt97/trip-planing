# Reset Supabase sạch và migrate lại

> Cảnh báo: bước reset xóa toàn bộ dữ liệu app trong các bảng `public.*` của Đà Lạt Nearby Planner. Tài khoản Google trong `auth.users` được giữ nguyên.

## 1. Reset schema app

Mở **Supabase Dashboard → SQL Editor → New query**, copy toàn bộ file:

```text
supabase/RESET_ALL.sql
```

và bấm **Run**.

File này xóa các bảng app, policies, triggers và RPC cũ nhưng không xóa người dùng Auth.

## 2. Migrate schema sạch

Tạo query mới, copy toàn bộ:

```text
supabase/migrations/001_v2_collaboration.sql
```

và **Run**.

Sau đó chạy tiếp:

```text
supabase/migrations/002_trip_features.sql
```

Migration mới tạo lại:

- `profiles`
- `trips`
- `trip_members`
- `places`
- `expenses`
- `place_votes`
- `checklists`
- `trips.people_count`
- `places.note_url` / `places.image_url`
- Supabase Storage bucket `place-images`
- indexes
- RLS policies
- Google profile trigger
- RPC `join_trip_by_slug`
- Realtime publication

RPC đã dùng alias đầy đủ nên không còn lỗi `column reference "trip_id" is ambiguous`.

## 3. Seed Trip mặc định

Ở máy local:

```bash
cp .env.example .env.local
```

Điền:

```env
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SECRET_KEY=sb_secret_xxx
DEFAULT_TRIP_SLUG=dalat-2026
```

Kiểm tra `data/default-places.json`, sau đó chạy:

```bash
npm run db:seed
```

## 4. Kiểm tra dữ liệu seed

Trong SQL Editor:

```sql
select id, slug, name, public_join, home_name, home_lat, home_lng
from public.trips
order by created_at;
```

Phải thấy Trip `dalat-2026` và `public_join = true`.

## 5. Login lại app

Đăng xuất/đăng nhập Google lại. User đầu tiên tham gia Trip sẽ thành `owner`, user tiếp theo thành `editor`.

Kiểm tra:

```sql
select tm.trip_id, tm.user_id, tm.role, tm.joined_at
from public.trip_members as tm
order by tm.joined_at;
```

## 6. Smoke test 2 tài khoản

- A login → owner
- B login → editor
- A thêm Place → B thấy qua Realtime
- B vote → A thấy vote
- B thêm Expense → A thấy tổng chi thay đổi
- A đổi số người → B thấy trung bình/người cập nhật
- A thêm public Checklist → B sửa/check được
- A thêm private Checklist → B không nhìn thấy
- A upload ảnh Place → B thấy ảnh qua Storage
- A đổi B thành viewer → B không còn sửa/xóa Place/Expense

Nếu các bước trên pass thì schema/RLS/realtime đã sạch.
