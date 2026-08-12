# Deploy Đà Lạt Nearby Planner v2 lên Vercel + Supabase + Google Login

Tài liệu này dành cho bản **v2 multi-user**. Mục tiêu cuối cùng:

- app chạy public trên Vercel;
- người trong nhóm đăng nhập bằng Google;
- tất cả cùng xem/sửa dữ liệu theo role;
- Places, Votes, Expenses và Members nằm trong Supabase Postgres;
- thay đổi được đồng bộ qua Supabase Realtime;
- danh sách địa điểm mặc định có thể seed trước khi cả nhóm sử dụng.

> Không commit `.env.local`. Không đưa `SUPABASE_SECRET_KEY` hoặc `SUPABASE_SERVICE_ROLE_KEY` vào frontend/Vercel nếu app không có endpoint admin cần nó.

---

## 1. Các link cần mở

- Supabase Dashboard: https://supabase.com/dashboard
- Tạo Supabase project mới: https://supabase.com/dashboard/new
- Tài liệu Supabase API keys: https://supabase.com/docs/guides/getting-started/api-keys
- Tài liệu Supabase Google Login: https://supabase.com/docs/guides/auth/social-login/auth-google
- Tài liệu Supabase Redirect URLs: https://supabase.com/docs/guides/auth/redirect-urls
- Google Cloud Console: https://console.cloud.google.com/
- Google Auth Platform: https://console.cloud.google.com/auth/overview
- Google OAuth Clients: https://console.cloud.google.com/auth/clients
- Vercel Dashboard: https://vercel.com/dashboard
- Tạo/import project Vercel: https://vercel.com/new
- Vercel Environment Variables: https://vercel.com/docs/projects/environment-variables
- GitHub New Repository: https://github.com/new

---

## 2. Tạo Supabase project

1. Mở https://supabase.com/dashboard/new.
2. Chọn Organization.
3. Đặt tên project, ví dụ `dalat-trip`.
4. Chọn region gần nhóm người dùng nhất. Nếu phần lớn ở Việt Nam, chọn region châu Á gần nhất đang được Supabase cung cấp cho account của bạn.
5. Tạo database password mạnh và lưu trong password manager.
6. Chờ project provision xong.

Bạn cần ghi lại **Project URL**. URL thường có dạng:

```text
https://abcdefghijk.supabase.co
```

### Lấy Supabase Publishable Key

Trong Supabase Dashboard:

```text
Project → Settings → API Keys
```

Hoặc mở **Connect** của project để xem thông tin kết nối.

Dùng key mới dạng:

```text
sb_publishable_...
```

Đây là key dùng cho browser. Nó vẫn phải đi cùng RLS để bảo vệ dữ liệu.

### Lấy Supabase Secret Key dùng cho seed

Cũng tại:

```text
Project → Settings → API Keys
```

Lấy key dạng:

```text
sb_secret_...
```

Key này chỉ dùng **local/server admin**, ví dụ `npm run db:seed`.

Không:

- commit key này;
- paste vào source code;
- dùng nó trong browser;
- tạo biến `NEXT_PUBLIC_*` cho key này;
- thêm vào Vercel nếu production app không cần thao tác admin server-side.

---

## 3. Tạo database schema + RLS + Realtime

Trong source code mở:

```text
supabase/migrations/001_v2_collaboration.sql
```

Trong Supabase:

```text
SQL Editor → New query
```

Copy toàn bộ migration vào và bấm **Run**.

Sau đó chạy tiếp migration tính năng:

```text
supabase/migrations/002_trip_features.sql
```

Migration này thêm `people_count`, Place media/link, Checklist, Realtime cho Checklist và Storage bucket `place-images`.

Migration sẽ tạo:

```text
profiles
trips
trip_members
places
expenses
place_votes
```

và cấu hình:

- Row Level Security;
- owner/editor/viewer;
- mỗi user một vote trên mỗi place;
- RPC join Trip;
- Realtime publication cho Places, Expenses, Votes, Members, Checklist và Trip settings;
- Supabase Storage bucket public `place-images` (upload chỉ owner/editor theo policy).

### Kiểm tra migration

Vào:

```text
Database → Tables
```

Bạn phải thấy các table trên.

Sau đó kiểm tra RLS đang bật cho các bảng collaboration.

---

## 4. Tạo Google OAuth App

Mở:

https://console.cloud.google.com/auth/overview

Chọn hoặc tạo Google Cloud project dành riêng cho app.

### 4.1 Cấu hình Audience / Consent Screen

Trong **Google Auth Platform**:

1. Điền App name, ví dụ `Đà Lạt Trip`.
2. Điền support email.
3. Chọn Audience phù hợp.
4. Nếu app còn ở trạng thái Testing, thêm các Gmail của nhóm vào **Test users**.

Nếu Gmail của thành viên không nằm trong test users khi app vẫn Testing, họ có thể không đăng nhập được.

### 4.2 Tạo OAuth Client

Mở:

https://console.cloud.google.com/auth/clients

Chọn:

```text
Create Client → Web application
```

Đặt tên, ví dụ:

```text
Dalat Planner Web
```

### 4.3 Authorized redirect URI quan trọng nhất

Google **không redirect trực tiếp về Vercel trước**. Google redirect về Supabase Auth callback.

Thêm URI:

```text
https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback
```

Ví dụ Project URL là:

```text
https://abcdefghijk.supabase.co
```

thì callback là:

```text
https://abcdefghijk.supabase.co/auth/v1/callback
```

Bạn cũng có thể copy chính xác callback này từ trang Google provider trong Supabase Dashboard.

Sau khi Create, Google sẽ cấp:

```text
Client ID
Client Secret
```

Lưu hai giá trị này.

---

## 5. Kết nối Google OAuth vào Supabase

Trong Supabase:

```text
Authentication → Providers → Google
```

Bật Google provider rồi nhập:

```text
Client ID     = Google OAuth Client ID
Client Secret = Google OAuth Client Secret
```

Save.

Google Client Secret nằm ở Supabase Auth server, **không nằm trong `.env.local` của frontend app này**.

---

## 6. Cấu hình Supabase Auth Redirect URLs

Trong Supabase:

```text
Authentication → URL Configuration
```

### Local development

Thêm:

```text
http://127.0.0.1:3000/**
http://localhost:3000/**
```

### Production

Sau khi có domain Vercel, ví dụ:

```text
https://dalat-trip.vercel.app
```

đặt:

```text
Site URL = https://dalat-trip.vercel.app
```

và thêm Redirect URL:

```text
https://dalat-trip.vercel.app/**
```

Production tốt nhất nên dùng exact production domain. Wildcard chủ yếu tiện cho local hoặc Vercel Preview.

Nếu cần Vercel Preview, có thể thêm pattern theo hướng dẫn Supabase, ví dụ:

```text
https://*-YOUR_VERCEL_TEAM_SLUG.vercel.app/**
```

---

## 7. Cấu hình local `.env.local`

Tại root project:

```bash
cp .env.example .env.local
```

Điền:

```env
# Fallback Home. Sau login, Home trong Trip database là source of truth.
HOME_NAME=Hotel Trường An Hotel
HOME_LAT=11.9370985
HOME_LNG=108.4220004

# Supabase public collaboration config
APP_ENV=prod
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxxxxxx
DEFAULT_TRIP_SLUG=dalat-2026

# Chỉ local để seed. Không expose cho browser.
SUPABASE_SECRET_KEY=sb_secret_xxxxxxxxx

# Optional routing
OPENROUTESERVICE_API_KEY=
ORS_BASE_URL=https://api.heigit.org
```

### Test local

```bash
npm install
npm run quality
npm run dev
```

Mở:

```text
http://127.0.0.1:3000
```

Expected flow:

1. thấy splash `Ní ơi, đang mở chuyến đi…`;
2. nếu chưa login → chỉ hiện Google Login, không flash dashboard;
3. login Google;
4. quay lại app;
5. lần đầu tự join Trip mặc định;
6. tải data dùng chung;
7. dashboard xuất hiện.

---

## 8. Seed danh sách địa điểm mặc định

Mở:

```text
data/default-places.json
```

Ví dụ:

```json
{
  "trip": {
    "slug": "dalat-2026",
    "name": "Đà Lạt 2026",
    "homeName": "Hotel Trường An Hotel",
    "homeLat": 11.9370985,
    "homeLng": 108.4220004,
    "publicJoin": true,
    "peopleCount": 4
  },
  "places": [
    {
      "seedKey": "cho-da-lat",
      "name": "Chợ Đà Lạt",
      "address": "Đà Lạt",
      "category": "attraction",
      "priority": "want",
      "note": "",
      "noteUrl": "https://example.com/ghi-chu",
      "imageUrl": "",
      "lat": 11.9426,
      "lng": 108.4370
    }
  ]
}
```

Sau đó:

```bash
npm run db:seed
```

Seed dùng upsert theo `trip slug` và `seedKey`, vì vậy chạy lại không tạo duplicate nếu bạn giữ `seedKey` ổn định.

Sau khi seed xong, bạn có thể xóa `SUPABASE_SECRET_KEY` khỏi `.env.local` nếu không còn cần thao tác admin.

---

## 9. Push source lên GitHub

Tạo repo tại:

https://github.com/new

Sau đó tại local:

```bash
git init
git add .
git commit -m "feat: dalat collaborative planner"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

Kiểm tra GitHub **không có** `.env.local`.

---

## 10. Deploy lên Vercel

Mở:

https://vercel.com/new

1. Connect GitHub nếu chưa kết nối.
2. Chọn repository.
3. Import project.
4. Root Directory để mặc định là root repository.
5. Project dùng `vercel.json` sẵn có.

### Environment Variables trên Vercel

Trước hoặc sau deploy, vào:

```text
Vercel Project → Settings → Environment Variables
```

Thêm:

```text
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
DEFAULT_TRIP_SLUG
HOME_NAME
HOME_LAT
HOME_LNG
ORS_BASE_URL
OPENROUTESERVICE_API_KEY   # optional
```

Không thêm:

```text
SUPABASE_SECRET_KEY
SUPABASE_SERVICE_ROLE_KEY
Google Client Secret
```

Google Client Secret đã được giữ ở Supabase Auth provider.

Sau khi sửa Environment Variables, **Redeploy** để deployment mới nhận giá trị.

---

## 11. Sau khi có URL Vercel production

Ví dụ Vercel cấp:

```text
https://dalat-trip.vercel.app
```

Làm lại hai bước sau.

### Supabase

```text
Authentication → URL Configuration
```

Đặt:

```text
Site URL = https://dalat-trip.vercel.app
Redirect URL = https://dalat-trip.vercel.app/**
```

### Google

Trong OAuth Client có thể thêm Authorized JavaScript origin:

```text
https://dalat-trip.vercel.app
```

**Authorized redirect URI vẫn là callback Supabase**:

```text
https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback
```

Đừng thay callback này thành `/` của Vercel, nếu không sẽ gặp `redirect_uri_mismatch`.

---

## 12. Test production bằng 2 tài khoản Google

Nên test trên hai browser profile hoặc hai điện thoại.

### Account A

1. Login.
2. Nếu là người đầu tiên join Trip → phải nhận role `owner`.
3. Thêm Place.
4. Vote Place.
5. Thêm Expense và đặt số người chia chi phí.
6. Upload ảnh/link ghi chú cho Place.
7. Thêm một Checklist public và một Checklist private.

### Account B

1. Login.
2. Mặc định join với role `editor` nếu `public_join=true`.
3. Không refresh thủ công vẫn phải nhận thay đổi qua Realtime.
4. Vote cùng Place.

### Quay lại Account A

1. Vào `Nhóm`.
2. Đổi B thành `viewer`.

### Account B

1. Sync role mới.
2. Không được thêm/sửa/xóa Place hoặc Expense.
3. Vẫn xem và vote được.

Đây là test quan trọng để xác nhận không chỉ UI mà **RLS database thật sự đang enforce quyền**.

---

## 13. Troubleshooting

### `redirect_uri_mismatch` từ Google

Kiểm tra Google Authorized redirect URI phải chính xác:

```text
https://PROJECT_REF.supabase.co/auth/v1/callback
```

Không thêm slash thừa.

### Login xong quay về localhost

Trong Supabase kiểm tra:

```text
Authentication → URL Configuration
```

- Site URL production có đúng không?
- Vercel production URL có nằm trong Redirect URLs không?

### App báo chưa cấu hình collaboration

Kiểm tra Vercel env:

```text
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
```

Sau khi thêm/sửa phải Redeploy.

### 401 / Invalid API key

Kiểm tra bạn đang dùng **Publishable key** dạng `sb_publishable_...` cho app.

Không dùng secret key ở browser.

### 403 / RLS / permission denied

Kiểm tra:

1. migration đã chạy đủ;
2. user đã login;
3. user đã join Trip;
4. role của user;
5. request có access token user.

Viewer bị chặn ghi dữ liệu là hành vi đúng.

### Seed báo 401/403

Local `.env.local` cần:

```text
SUPABASE_URL
SUPABASE_SECRET_KEY
```

`SUPABASE_PUBLISHABLE_KEY` không đủ quyền để seed admin data trước user login.

### Hai máy không realtime

Kiểm tra:

- migration đã add các table vào `supabase_realtime` publication;
- browser không block WebSocket;
- CSP production vẫn cho `wss://*.supabase.co`;
- hai user cùng một Trip;
- RLS cho phép cả hai đọc row đó.

App cũng có reconnect/backoff và sync lại khi trở về foreground/online.

### Vercel deploy được nhưng `/api/config` thiếu env

Vào:

```text
Project → Settings → Environment Variables
```

kiểm tra biến có áp dụng cho `Production`, sau đó Redeploy.

---

## 14. Checklist trước khi gửi link cho cả nhóm

- [ ] Migration chạy thành công.
- [ ] Google provider bật trong Supabase.
- [ ] Google redirect URI trỏ về Supabase callback.
- [ ] Supabase Site URL là domain production.
- [ ] Supabase Redirect URLs có domain production.
- [ ] Vercel có `SUPABASE_URL`.
- [ ] Vercel có `SUPABASE_PUBLISHABLE_KEY`.
- [ ] Vercel không có Supabase secret/service-role key nếu không cần.
- [ ] Seed default places thành công.
- [ ] Account A login được.
- [ ] Account B login được.
- [ ] Realtime A ↔ B hoạt động.
- [ ] Vote sync đúng.
- [ ] Expense sync đúng.
- [ ] Viewer bị chặn sửa/xóa.
- [ ] Mobile login không flash dashboard trước khi auth resolve.



## Cấu hình UI không cần sửa source (v2.2)

Thêm các biến sau vào `.env.local` và Vercel Environment Variables nếu muốn thay đổi giao diện mặc định:

```env
UI_EYEBROW=ĐÀ LẠT · TRIP COMPANION
UI_TITLE=Ní ơi, mình đi đâu thế.
UI_SUBTITLE=Lên danh sách, xem khoảng cách và chọn nơi đáng đi ngay lúc này.
UI_DEFAULT_PAGE_SIZE=8
UI_DEFAULT_RADIUS_KM=5
UI_DEFAULT_CATEGORY=all
UI_DEFAULT_SORT=distance
UI_DEFAULT_RADAR_RADIUS_KM=5
UI_DEFAULT_RADAR_CATEGORY=all
```

Các giá trị được backend `/api/config` expose như cấu hình public UI và được validate trước khi áp dụng. Secret Supabase/ORS không nằm trong nhóm UI config này. Sau khi thay Environment Variables trên Vercel, redeploy để giá trị mới có hiệu lực.

## Migration hiện tại (v2.8+)

Nếu production đã ở v2.7.x, chạy thêm:

```text
supabase/migrations/004_checklist_per_user_completion.sql
```

Migration này chuyển checklist completion từ trạng thái dùng chung sang completion riêng từng user. Không cần reset database.


## Nâng từ v2.8.x lên v2.9.0

Không reset database. Vào Supabase SQL Editor và chạy `supabase/migrations/005_timeline_expense_settlement.sql`, sau đó redeploy Vercel. Migration thêm Timeline và cột `expenses.participants`. PWA không cần thêm environment variable.
